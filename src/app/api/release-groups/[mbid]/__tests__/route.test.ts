import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { releaseStore } from '@/lib/cache/release-store';
import { CachedReleaseGroup } from '@/lib/types/cache';
import { queueReleaseGroupRefresh } from '@/lib/prefetch/prefetch-service';
import { GET, POST } from '../route';

// Hoisted above the imports: the route gets the mocked refresh queue
vi.mock('@/lib/prefetch/prefetch-service', () => ({ queueReleaseGroupRefresh: vi.fn() }));

const RG = 'b1392450-e666-3926-a536-22c65f834433';

const cacheAlbum = (release: Record<string, unknown>) => {
  releaseStore.set('r1', { id: 'r1', title: 'OK Computer', ...release } as never);
  releaseGroupCache.set(RG, {
    id: RG,
    title: 'OK Computer',
    releaseMbids: ['r1'],
    bestReleaseMbid: 'r1',
    _cachedAt: Date.now(),
    _expiresAt: Date.now() + 1000,
  } as unknown as CachedReleaseGroup);
};

const get = () => GET(new NextRequest(`http://localhost/api/release-groups/${RG}`), { params: Promise.resolve({ mbid: RG }) });

describe('GET /api/release-groups/[mbid]', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    releaseGroupCache.clear();
    releaseStore.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.mocked(queueReleaseGroupRefresh).mockClear();
  });

  it('serves an album cached without url-rels at once and refreshes it in the background', async () => {
    cacheAlbum({});

    const json = await (await get()).json();

    expect(json.data.title).toBe('OK Computer');
    expect(json.metadata).toMatchObject({ source: 'cache', stale: true });
    expect(queueReleaseGroupRefresh).toHaveBeenCalledWith(RG);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves a complete album without a refresh', async () => {
    cacheAlbum({ relations: [] });

    const json = await (await get()).json();

    expect(json.metadata).toMatchObject({ source: 'cache', stale: false });
    expect(queueReleaseGroupRefresh).not.toHaveBeenCalled();
  });

  it('fetches an album without url-rels live when the prefetch is turned off', async () => {
    vi.stubEnv('PREFETCH_ENABLED', 'false');
    cacheAlbum({});
    fetchMock.mockResolvedValue(new Response('{}', { status: 503, statusText: 'Service Unavailable' }));

    const response = await get();

    expect(fetchMock).toHaveBeenCalled();
    expect(response.status).toBe(503);
  });

  it('answers 502 with a "try again" message when MusicBrainz is unreachable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const response = await get();

    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe('MusicBrainz is unreachable, please try again in a moment');
  });

  it('keeps 500 for errors that are not network failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('unexpected bug'));

    const response = await POST(new NextRequest(`http://localhost/api/release-groups/${RG}`, { method: 'POST' }), {
      params: Promise.resolve({ mbid: RG }),
    });

    expect(response.status).toBe(500);
  });
});
