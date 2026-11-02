import { describe, it, expect } from 'vitest';
import { toPanelDetails } from '../useAlbums';
import type { ReleaseGroup } from '@/types/music';

const raw = {
  id: 'rg-1',
  title: 'Back in Black',
  'first-release-date': '1980-07-25',
  'primary-type': 'Album',
  'secondary-types': ['Live'],
  'artist-credit': [{ name: 'AC/DC', joinphrase: '', artist: { id: 'a', name: 'AC/DC' } }],
  rating: { value: 4.4, 'votes-count': 31 },
  genres: [{ name: 'hard rock', count: 9 }],
  tags: [],
  releases: [],
  tracklist: [{ position: 1, title: 'Hells Bells' }],
  cover: '/api/coverart/release-group/rg-1/front',
};

describe('toPanelDetails', () => {
  it('turns the raw MusicBrainz rating into the shape the panel reads', () => {
    const details = toPanelDetails(raw);
    expect(details.rating?.average).toBe(4.4);
    expect(details.rating?.count).toBe(31);
    expect(details.primary_type).toBe('Album');
    expect(details.secondary_types).toEqual(['Live']);
    expect(details.first_release_date).toBe('1980-07-25');
    expect(details.tracklist).toHaveLength(1);
    expect(details.cover).toBe(raw.cover);
  });

  it('keeps the personal rating from the grid entry', () => {
    const grid = { id: 'rg-1', rating: { average: 4.4, count: 31, personal: 5 } } as unknown as ReleaseGroup;
    expect(toPanelDetails(raw, grid).rating?.personal).toBe(5);
  });

  it('falls back to the grid rating when the details carry none', () => {
    const grid = { id: 'rg-1', rating: { average: 3, count: 2, personal: null } } as unknown as ReleaseGroup;
    const { rating, ...noRating } = raw;
    void rating;
    expect(toPanelDetails(noRating, grid).rating?.average).toBe(3);
  });

  it('leaves already-normalized cached details intact', () => {
    const cached = toPanelDetails(raw);
    expect(toPanelDetails(cached).rating?.average).toBe(4.4);
  });
});
