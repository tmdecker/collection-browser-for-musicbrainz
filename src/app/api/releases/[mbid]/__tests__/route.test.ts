import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { releaseStore } from '@/lib/cache/release-store';
import { CachedReleaseGroup } from '@/lib/types/cache';
import { openCacheDatabase, setCacheDatabase } from '@/lib/cache/database';
import { getReleaseChoice, setReleaseChoice } from '@/lib/release-choices';
import { GET } from '../route';

vi.mock('@/lib/prefetch/prefetch-service', () => ({ queueReleaseGroupRefresh: vi.fn() }));
vi.mock('@/lib/rate-limiter', () => ({ waitForRateLimit: () => Promise.resolve(), backOffMusicBrainz: () => {} }));

const RG = 'b1392450-e666-3926-a536-22c65f834433';
const CD = '11111111-1111-4111-8111-111111111111';
const VINYL = '22222222-2222-4222-8222-222222222222';

const tracks = (title: string) => [{ position: 1, format: 'CD', 'track-count': 1, tracks: [{ id: 't1', number: '1', title }] }];

// The album as a click on it leaves it in the cache: every release from the browse, the app's pick with tracks
const cacheAlbum = () => {
  const stamp = { releaseGroupId: RG, _cachedAt: Date.now(), _expiresAt: Date.now() + 100000 };
  releaseStore.set(CD, { id: CD, title: 'OK Computer', date: '1997-05-21', country: 'GB', relations: [], media: tracks('Airbag'), ...stamp } as never);
  releaseStore.set(VINYL, {
    id: VINYL, title: 'OK Computer', date: '2016-08-19', country: 'XE', relations: [],
    media: [{ position: 1, format: '12" Vinyl', 'track-count': 6 }], 'cover-art-archive': { front: false }, ...stamp,
  } as never);
  releaseGroupCache.set(RG, {
    id: RG, title: 'OK Computer', 'first-release-date': '1997-05-21', releaseMbids: [CD, VINYL], bestReleaseMbid: CD,
    _cachedAt: Date.now(), _expiresAt: Date.now() + 100000,
  } as unknown as CachedReleaseGroup);
};

const get = (mbid: string) => GET(new NextRequest(`http://localhost/api/releases/${mbid}`), { params: Promise.resolve({ mbid }) });
const mbJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('GET /api/releases/[mbid]', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setCacheDatabase(openCacheDatabase(':memory:'));
    releaseGroupCache.clear();
    releaseStore.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects anything that is not an MBID', async () => {
    expect((await get('not-an-id')).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers a cached release that has its tracklist without asking MusicBrainz', async () => {
    cacheAlbum();

    const { data } = await (await get(CD)).json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(data.id).toBe(CD);
    expect(data.releaseGroupId).toBe(RG);
    expect(data.selectedReleaseId).toBe(CD);
    expect(data.tracklist[0].title).toBe('Airbag');
    expect(data.pinnedRelease).toEqual({ date: '1997-05-21', country: 'GB', format: 'CD' });
    expect(data.cover).toBe(`/api/coverart/release/${CD}/front`);
    expect(data.releases).toHaveLength(2);
  });

  it('shows the asked release, not the one chosen in the Releases tab, and leaves that choice alone', async () => {
    cacheAlbum();
    setReleaseChoice(RG, CD);
    fetchMock.mockResolvedValue(mbJson({
      id: VINYL, title: 'OK Computer', date: '2016-08-19', country: 'XE', 'release-group': { id: RG },
      'cover-art-archive': { front: false },
      media: [{ position: 1, format: '12" Vinyl', 'track-count': 1, tracks: [{ id: 'v1', number: 'A1', title: 'Airbag (vinyl)' }] }],
    }));

    const { data } = await (await get(VINYL)).json();

    // One lookup: the tracklist of this release (the browse of all releases has none)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/release/${VINYL}?`);
    expect(data.id).toBe(VINYL);
    expect(data.selectedReleaseId).toBe(VINYL);
    expect(data.tracklist[0].title).toBe('Airbag (vinyl)');
    expect(data.first_release_date).toBe('2016-08-19');
    expect(data.releaseChoice).toBeNull();
    // No front cover of its own: the release group's
    expect(data.cover).toBe(`/api/coverart/release-group/${RG}/front`);
    expect(getReleaseChoice(RG)).toBe(CD);
    expect(releaseGroupCache.get(RG)?.bestReleaseMbid).toBe(CD);
  });

  it('finds the release group of an unknown release and loads the album', async () => {
    const release = {
      id: VINYL, title: 'OK Computer', date: '2016-08-19', 'release-group': { id: RG },
      media: [{ position: 1, format: '12" Vinyl', 'track-count': 1, tracks: [{ id: 'v1', number: 'A1', title: 'Airbag (vinyl)' }] }],
    };
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes(`/release/${VINYL}?`)) return mbJson(release);
      if (url.includes(`/release-group/${RG}?`)) return mbJson({ id: RG, title: 'OK Computer', 'first-release-date': '1997-05-21' });
      if (url.includes(`release-group=${RG}`)) return mbJson({ 'release-count': 1, releases: [{ id: VINYL, title: 'OK Computer', date: '2016-08-19', relations: [] }] });
      return new Response('{}', { status: 404 });
    });

    const { data } = await (await get(VINYL)).json();

    expect(data.releaseGroupId).toBe(RG);
    expect(data.tracklist[0].title).toBe('Airbag (vinyl)');
    expect(releaseGroupCache.get(RG)?.releaseMbids).toEqual([VINYL]);
  });

  it('passes on that MusicBrainz is busy', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 503, statusText: 'Service Unavailable' }));

    const response = await get(VINYL);

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('MusicBrainz is busy, please try again in a moment');
  });
});
