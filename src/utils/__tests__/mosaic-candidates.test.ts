import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCollectionCandidates, loadSeriesCollectionCandidates } from '../mosaic-candidates';

const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
};

const json = (body: unknown) => ({ ok: true, json: async () => body });

describe('mosaic candidates', () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', localStorageStub);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the same first page as the collection page (the server copy is keyed by it), once', async () => {
    const fetchMock = vi.fn(async (_url: string) => json({ 'release-groups': Array.from({ length: 20 }, (_, i) => ({ id: `rg-${i}` })) }));
    vi.stubGlobal('fetch', fetchMock);

    const ids = await loadCollectionCandidates('c1');
    expect(ids).toHaveLength(12);
    expect(ids[0]).toBe('rg-0');
    const url = new URL(fetchMock.mock.calls[0][0], 'http://x');
    expect(url.pathname).toBe('/api/musicbrainz/release-group');
    expect([...url.searchParams.keys()]).toEqual(['fmt', 'collection', 'inc', 'limit', 'offset']);
    expect(url.searchParams.get('inc')).toBe('artist-credits+genres+tags+ratings');
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('offset')).toBe('0');

    // Remembered in this browser: no second request
    expect(await loadCollectionCandidates('c1')).toEqual(ids);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the first release group series of a series collection', async () => {
    const fetchMock = vi.fn(async (url: string) => url.startsWith('/api/musicbrainz/series?')
      ? json({ 'series-count': 2, series: [
        { id: 'w1', name: 'Works', type: 'Work series' },
        { id: 's1', name: 'Best of', type: 'Release group series' },
      ] })
      : json({ relations: [
        { type: 'part of', 'target-type': 'release_group', release_group: { id: 'rg-a' } },
        { type: 'other', 'target-type': 'url' },
        { type: 'part of', 'target-type': 'release_group', 'release-group': { id: 'rg-b' } },
      ] }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await loadSeriesCollectionCandidates('sc1')).toEqual(['rg-a', 'rg-b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/musicbrainz/series/s1?fmt=json&inc=release-group-rels');
  });
});
