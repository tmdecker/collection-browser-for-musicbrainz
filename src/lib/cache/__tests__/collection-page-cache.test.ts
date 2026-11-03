import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { collectionPageCache, isCollectionPageRequest } from '@/lib/cache/collection-page-cache';
import { GET } from '@/app/api/musicbrainz/[...path]/route';

// No 1.1 s spacing between requests in tests (vi.mock is hoisted above the imports)
vi.mock('@/lib/rate-limiter', () => ({ waitForRateLimit: () => Promise.resolve(), backOffMusicBrainz: () => {} }));

const COLLECTION = 'c0ffee00-1111-4222-a333-444455556666';
const PAGE_URL = `http://localhost/api/musicbrainz/release-group?fmt=json&collection=${COLLECTION}&limit=100&offset=0`;

const call = (url: string, { token, refresh }: { token?: string; refresh?: boolean } = {}) => {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `mb_access_token=${token}`;
  if (refresh) headers['x-mb-refresh'] = '1';
  const path = new URL(url).pathname.replace('/api/musicbrainz/', '').split('/');
  return GET(new NextRequest(url, { headers }), { params: Promise.resolve({ path }) });
};

describe('collection page cache in the MusicBrainz proxy', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let version: number;

  beforeEach(() => {
    collectionPageCache.clear();
    version = 1;
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ 'release-groups': [{ id: `v${version}` }] })));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('only treats collection list pages as cacheable', () => {
    expect(isCollectionPageRequest(['release-group'], new URLSearchParams({ collection: COLLECTION }))).toBe(true);
    expect(isCollectionPageRequest(['release-group', COLLECTION], new URLSearchParams())).toBe(false);
    expect(isCollectionPageRequest(['collection', COLLECTION], new URLSearchParams())).toBe(false);
  });

  it('serves a stored page without asking MusicBrainz again', async () => {
    expect(await (await call(PAGE_URL)).json()).toEqual({ 'release-groups': [{ id: 'v1' }] });
    version = 2;
    const second = await call(PAGE_URL);
    expect(second.headers.get('x-mb-cache')).toBe('hit');
    expect(await second.json()).toEqual({ 'release-groups': [{ id: 'v1' }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches live and updates the copy when asked to refresh', async () => {
    await call(PAGE_URL);
    version = 2;
    expect(await (await call(PAGE_URL, { refresh: true })).json()).toEqual({ 'release-groups': [{ id: 'v2' }] });
    expect(await (await call(PAGE_URL)).json()).toEqual({ 'release-groups': [{ id: 'v2' }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never shows a signed-in copy to a request without a login', async () => {
    await call(PAGE_URL, { token: 'secret' });
    await call(PAGE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // A signed-in request may use the public copy
    await call(PAGE_URL, { token: 'other' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not store failed responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    await call(PAGE_URL);
    await call(PAGE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
