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
});
