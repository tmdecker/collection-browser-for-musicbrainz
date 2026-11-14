import { describe, expect, it } from 'vitest';
import { ReleaseGroup } from '@/types/music';
import { normalizeReleaseGroup } from '../normalize-mb-data';
import { cardFactLine, isReleaseItem, musicBrainzUrlOf, releaseGroupIdOf, releaseItemCoverUrl, releaseToItem } from '../release-items';

// A release as a collection browse returns it (inc=artist-credits+release-groups+media+labels)
const browsed = {
  id: 'rel-1',
  title: 'OK Computer',
  date: '2016-08-19',
  country: 'XE',
  'artist-credit': [{ name: 'Radiohead', artist: { id: 'a1', name: 'Radiohead' } }],
  media: [{ format: '12" Vinyl', 'track-count': 6, position: 1 }, { format: '12" Vinyl', 'track-count': 6, position: 2 }],
  'label-info': [{ label: { id: 'l1', name: 'XL Recordings' } }],
  'cover-art-archive': { front: true },
  'release-group': {
    id: 'rg-1',
    title: 'OK Computer',
    'primary-type': 'Album',
    'secondary-types': [],
    'first-release-date': '1997-05-21',
    genres: [{ name: 'art rock', count: 9 }],
    rating: { value: 4.6, 'votes-count': 12 },
  },
};

describe('release items', () => {
  it('turns a collected release into a grid entry that knows its release group', () => {
    const item = normalizeReleaseGroup(releaseToItem(browsed));

    expect(item.id).toBe('rel-1');
    expect(item.releaseGroupId).toBe('rg-1');
    expect(item.pinnedRelease).toEqual({ date: '2016-08-19', country: 'XE', format: '2×12″ Vinyl' });
    expect(item.cover).toBe('/api/coverart/release/rel-1/front');
    // The release's own date, the release group's type, genres and rating
    expect(item.first_release_date).toBe('2016-08-19');
    expect(item.primary_type).toBe('Album');
    expect(item.genres).toEqual([{ name: 'art rock', count: 9 }]);
    expect(item.rating?.average).toBeCloseTo(4.6);
    expect(item.artist_credit[0].name).toBe('Radiohead');
    // Labels are known before the details load (label filter)
    expect(item.releaseDetails?.['label-info']?.[0].label.name).toBe('XL Recordings');
    expect(cardFactLine(item)).toBe('2×12″ Vinyl · 2016');
    expect(releaseGroupIdOf(item)).toBe('rg-1');
    expect(musicBrainzUrlOf(item)).toBe('https://musicbrainz.org/release/rel-1');
  });

  it('builds an entry from a series relation, which has no release group and no media', () => {
    const item = normalizeReleaseGroup(releaseToItem({ id: 'rel-2', title: 'Vol. 1', date: '2016-01-27', country: 'JP' }));

    expect(isReleaseItem(item)).toBe(true);
    expect(item.releaseGroupId).toBeUndefined();
    expect(releaseGroupIdOf(item)).toBeUndefined();
    expect(item.pinnedRelease).toEqual({ date: '2016-01-27', country: 'JP', format: undefined });
    expect(item.cover).toBe('/api/coverart/release/rel-2/front');
    expect(cardFactLine(item)).toBe('2016');
  });

  it('uses the release group cover when the release has no front cover', () => {
    expect(releaseItemCoverUrl('rel-1', 'rg-1', { front: false })).toBe('/api/coverart/release-group/rg-1/front');
    expect(releaseItemCoverUrl('rel-1', undefined, { front: false })).toBe('/api/coverart/release/rel-1/front');
    expect(releaseItemCoverUrl('rel-1', 'rg-1', undefined)).toBe('/api/coverart/release/rel-1/front');
  });

  it('leaves a release group entry as it was', () => {
    const album = { id: 'rg-9', first_release_date: '1997-05-21' } as ReleaseGroup;
    expect(isReleaseItem(album)).toBe(false);
    expect(releaseGroupIdOf(album)).toBe('rg-9');
    expect(cardFactLine(album)).toBe('1997');
    expect(musicBrainzUrlOf(album)).toBe('https://musicbrainz.org/release-group/rg-9');
  });
});
