import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// No 1.1 s spacing between requests in tests; record back-offs (vi.mock is hoisted above the imports)
const backOff = vi.fn();
vi.mock('@/lib/rate-limiter', () => ({ waitForRateLimit: () => Promise.resolve(), backOffMusicBrainz: (r: Response) => backOff(r.status) }));

import { GET } from '@/app/api/musicbrainz/collections/route';

const call = () => GET(new NextRequest('http://localhost/api/musicbrainz/collections?username=tim', {
  headers: { cookie: 'mb_access_token=token' },
}));

const ok = () => new Response(JSON.stringify({ collections: [{ id: 'a', name: 'Mine', 'entity-type': 'series' }] }));
const busy = () => new Response('busy', { status: 503, headers: { 'retry-after': '1' } });

describe('collections list route', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => backOff.mockClear());
  afterEach(() => vi.unstubAllGlobals());

  it('returns collections of every entity type', async () => {
    fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    const body = await (await call()).json();
    expect(body.collections).toEqual([{ id: 'a', name: 'Mine', 'entity-type': 'series' }]);
  });

  it('pauses all MusicBrainz requests after a 503 and tries once more', async () => {
    fetchMock = vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);
    const response = await call();
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(backOff).toHaveBeenCalledWith(503);
  });

  it('gives up after the second 503', async () => {
    fetchMock = vi.fn(async () => busy());
    vi.stubGlobal('fetch', fetchMock);
    const response = await call();
    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
