import { describe, expect, it } from 'vitest';
import { mergeCollectionEntry } from '@/utils/db';
import { ReleaseGroup } from '@/types/music';

const basic = { id: 'rg-1', title: 'New Title', genres: [{ name: 'jazz', count: 2 }] } as unknown as ReleaseGroup;

describe('mergeCollectionEntry', () => {
  it('keeps album details stored earlier when the collection is refreshed', () => {
    const detailed = {
      id: 'rg-1',
      title: 'Old Title',
      releases: [{ id: 'r1' }],
      tracklist: [{ title: 'Track 1' }],
      _cachedAt: 123,
    } as unknown as ReleaseGroup;

    const merged = mergeCollectionEntry(detailed, basic);

    expect(merged.title).toBe('New Title');
    expect(merged.genres).toEqual(basic.genres);
    expect(merged.releases).toEqual(detailed.releases);
    expect(merged.tracklist).toEqual(detailed.tracklist);
    expect(merged._cachedAt).toBe(123);
  });

  it('stores the collection entry as is for a new album', () => {
    expect(mergeCollectionEntry(undefined, basic)).toBe(basic);
  });

  it('keeps genres, tags and rating filled in afterwards when a series arrives without them again', () => {
    const enhanced = { id: 'rg-1', title: 'T', genres: [{ name: 'jazz', count: 2 }], tags: [], rating: { average: 4 } } as unknown as ReleaseGroup;
    const fresh = { id: 'rg-1', title: 'T', genres: [], tags: [] } as unknown as ReleaseGroup;

    const merged = mergeCollectionEntry(enhanced, fresh);

    expect(merged.genres).toEqual(enhanced.genres);
    expect(merged.rating).toEqual(enhanced.rating);
  });

  it('keeps what was looked up for a release of a release series (release group, type, format, cover)', () => {
    const lookedUp = {
      id: 'rel-1', title: 'T', releaseGroupId: 'rg-1', primary_type: 'Album', cover: '/api/coverart/release-group/rg-1/front',
      pinnedRelease: { date: '2016', country: 'JP', format: 'CD' },
    } as unknown as ReleaseGroup;
    const fresh = {
      id: 'rel-1', title: 'T', primary_type: '', cover: '/api/coverart/release/rel-1/front',
      pinnedRelease: { date: '2016-01-27', country: 'JP', format: undefined },
    } as unknown as ReleaseGroup;

    const merged = mergeCollectionEntry(lookedUp, fresh);

    expect(merged.releaseGroupId).toBe('rg-1');
    expect(merged.primary_type).toBe('Album');
    expect(merged.pinnedRelease).toEqual({ date: '2016-01-27', country: 'JP', format: 'CD' });
    expect(merged.cover).toBe('/api/coverart/release-group/rg-1/front');
  });
});
