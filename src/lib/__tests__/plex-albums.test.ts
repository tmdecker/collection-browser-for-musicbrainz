import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPlexAlbumLinks,
  getPlexConfig,
  matchReleaseGroups,
  plexAlbumUrl,
  resetPlexAlbumLinks,
} from '@/lib/plex-albums';
import { releaseStore } from '@/lib/cache/release-store';
import { GET } from '@/app/api/plex/albums/route';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const RELEASE_A = '5512ae09-9a25-4142-8db8-a84c44c369e5';
const RELEASE_B = 'b23f38c1-9583-46f6-8e8e-f7dc6dc4ddd2';
const RELEASE_UNKNOWN = '94d28b64-3cad-42c8-b0fd-f04cd1465319';
const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'secret-plex-token';

describe('getPlexConfig', () => {
  it('is off without PLEX_TOKEN', () => {
    expect(getPlexConfig({})).toBeNull();
    expect(getPlexConfig({ PLEX_TOKEN: '  ' })).toBeNull();
  });

  it('uses localhost and app.plex.tv by default', () => {
    expect(getPlexConfig({ PLEX_TOKEN: 'abc' })).toEqual({
      url: 'http://localhost:32400',
      token: 'abc',
      webUrl: 'https://app.plex.tv/desktop/',
    });
  });

  it('accepts only http(s) web URLs', () => {
    const config = getPlexConfig({ PLEX_TOKEN: 'abc', PLEX_URL: 'http://10.0.0.2:32400/', PLEX_WEB_URL: 'javascript:alert(1)' });
    expect(config?.url).toBe('http://10.0.0.2:32400');
    expect(config?.webUrl).toBe('https://app.plex.tv/desktop/');
  });
});

describe('plexAlbumUrl', () => {
  it('opens the album details page in Plex Web', () => {
    expect(plexAlbumUrl('https://app.plex.tv/desktop/', 'abc123', '4711')).toBe(
      'https://app.plex.tv/desktop/#!/server/abc123/details?key=%2Flibrary%2Fmetadata%2F4711'
    );
    expect(plexAlbumUrl('http://100.1.2.3:32400/web/index.html#!/', 'abc', '1')).toBe(
      'http://100.1.2.3:32400/web/index.html#!/server/abc/details?key=%2Flibrary%2Fmetadata%2F1'
    );
  });
});

describe('matchReleaseGroups', () => {
  it('maps releases to release groups and keeps the first of two Plex albums', () => {
    const groups: Record<string, string> = { [RELEASE_A]: GROUP_A, [RELEASE_B]: GROUP_B };
    const matches = matchReleaseGroups(
      [
        { ratingKey: '1', title: 'Engage!', releaseMbid: RELEASE_A },
        { ratingKey: '2', title: 'Anthology (disc 1)', releaseMbid: RELEASE_B },
        { ratingKey: '3', title: 'Anthology (disc 2)', releaseMbid: RELEASE_B },
        { ratingKey: '4', title: 'Not in the collection', releaseMbid: RELEASE_UNKNOWN },
      ],
      mbid => groups[mbid]
    );
    expect(Object.keys(matches).sort()).toEqual([GROUP_A, GROUP_B]);
    expect(matches[GROUP_B].ratingKey).toBe('2');
  });
});

describe('getPlexAlbumLinks', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetPlexAlbumLinks();
    vi.stubEnv('PLEX_TOKEN', TOKEN);
    releaseStore.set(RELEASE_A, { id: RELEASE_A, title: 'Engage!', releaseGroupId: GROUP_A } as never);
    releaseStore.set(RELEASE_B, { id: RELEASE_B, title: 'Anthology', releaseGroupId: GROUP_B } as never);

    fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url === 'http://localhost:32400/identity') return json({ MediaContainer: { machineIdentifier: 'machine1' } });
      if (url === 'http://localhost:32400/library/sections') {
        return json({ MediaContainer: { Directory: [{ key: '3', type: 'artist' }, { key: '1', type: 'movie' }] } });
      }
      if (url === 'http://localhost:32400/library/sections/3/all?type=9&includeGuids=1') {
        return json({
          MediaContainer: {
            Metadata: [
              { ratingKey: '10', title: 'Engage!', Guid: [{ id: `mbid://${RELEASE_A}` }] },
              { ratingKey: '11', title: 'Anthology', Guid: [{ id: 'discogs://1' }, { id: `mbid://${RELEASE_B}` }] },
              { ratingKey: '12', title: 'Spiral', Guid: [{ id: `mbid://${RELEASE_UNKNOWN}` }] },
              { ratingKey: '13', title: 'Unmatched' },
            ],
          },
        });
      }
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is off without a token and asks Plex nothing', async () => {
    vi.stubEnv('PLEX_TOKEN', '');
    expect(await getPlexAlbumLinks()).toEqual({ enabled: false, albums: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('links cached albums to Plex and sends the token only as a header', async () => {
    const result = await getPlexAlbumLinks();
    expect(result).toEqual({
      enabled: true,
      albums: {
        [GROUP_A]: 'https://app.plex.tv/desktop/#!/server/machine1/details?key=%2Flibrary%2Fmetadata%2F10',
        [GROUP_B]: 'https://app.plex.tv/desktop/#!/server/machine1/details?key=%2Flibrary%2Fmetadata%2F11',
      },
    });
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain(TOKEN);
      expect((init as RequestInit).headers).toMatchObject({ 'X-Plex-Token': TOKEN });
    }
  });

  it('reads Plex once for concurrent requests and again after 10 minutes', async () => {
    await Promise.all([getPlexAlbumLinks(), getPlexAlbumLinks()]);
    const calls = fetchMock.mock.calls.length;
    await getPlexAlbumLinks();
    expect(fetchMock.mock.calls.length).toBe(calls);
    await getPlexAlbumLinks(Date.now() + 11 * 60 * 1000);
    expect(fetchMock.mock.calls.length).toBe(calls * 2);
  });

  it('reports an error without the token when Plex rejects it', async () => {
    fetchMock.mockImplementation(async () => json({}, 401));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await getPlexAlbumLinks();
    expect(result).toEqual({ enabled: true, albums: {}, error: 'Plex could not be reached' });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(TOKEN);
    errorSpy.mockRestore();
  });

  it('never puts the token in the API response', async () => {
    const response = await GET();
    const body = await response.text();
    expect(body).toContain(GROUP_A);
    expect(body).not.toContain(TOKEN);
  });
});

describe('getPlexAlbumLinks with albums cached later', () => {
  const LATE_RELEASE = '94d28b64-3cad-42c8-b0fd-f04cd1465319';
  const LATE_GROUP = 'da4462e7-4225-42e5-af2d-d076f7a474a9';

  beforeEach(() => {
    resetPlexAlbumLinks();
    vi.stubEnv('PLEX_TOKEN', TOKEN);
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/identity')) return json({ MediaContainer: { machineIdentifier: 'machine1' } });
      if (url.endsWith('/library/sections')) return json({ MediaContainer: { Directory: [{ key: '3', type: 'artist' }] } });
      return json({ MediaContainer: { Metadata: [{ ratingKey: '12', title: 'Spiral', Guid: [{ id: `mbid://${LATE_RELEASE}` }] }] } });
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('links an album as soon as its release is cached, without reading Plex again', async () => {
    expect((await getPlexAlbumLinks()).albums[LATE_GROUP]).toBeUndefined();
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    releaseStore.set(LATE_RELEASE, { id: LATE_RELEASE, title: 'Spiral', releaseGroupId: LATE_GROUP } as never);

    expect((await getPlexAlbumLinks()).albums[LATE_GROUP]).toContain('%2Flibrary%2Fmetadata%2F12');
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });
});
