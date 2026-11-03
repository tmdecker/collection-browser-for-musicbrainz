import { describe, it, expect } from 'vitest';
import { sortByRating } from '@/utils/ratings';
import type { ReleaseGroup } from '@/types/music';

const album = (id: string, average: number | null, count: number, personal: number | null = null, artist = 'A') =>
  ({ id, title: id, artist_credit: [{ artist: { id, name: artist } }], rating: { average, count, personal, requiresAuth: false } }) as unknown as ReleaseGroup;

const ids = (albums: ReleaseGroup[]) => albums.map(a => a.id);

describe('sortByRating', () => {
  const albums = [
    album('one-vote-5', 5, 1),
    album('many-4.4', 4.4, 200),
    album('unrated', null, 0),
    album('many-2', 2, 50),
    album('few-3', 3, 2),
  ];

  it('weights averages by votes, highest first, unrated last', () => {
    expect(ids(sortByRating(albums, 'average', 'high-low'))).toEqual(['many-4.4', 'one-vote-5', 'few-3', 'many-2', 'unrated']);
  });

  it('keeps unrated albums last when sorting lowest first', () => {
    expect(ids(sortByRating(albums, 'average', 'low-high'))).toEqual(['many-2', 'few-3', 'one-vote-5', 'many-4.4', 'unrated']);
  });

  it('puts more votes first when scores are equal, then sorts by artist', () => {
    const tied = [album('b', 4, 10, null, 'B'), album('a', 4, 10, null, 'A'), album('more', 4, 30, null, 'Z')];
    expect(ids(sortByRating(tied, 'average', 'high-low'))).toEqual(['more', 'a', 'b']);
  });

  it('uses the plain personal rating in personal mode', () => {
    const mine = [album('p3', 5, 1, 3), album('p5', 2, 100, 5), album('none', 4, 9, null)];
    expect(ids(sortByRating(mine, 'personal', 'high-low'))).toEqual(['p5', 'p3', 'none']);
    expect(ids(sortByRating(mine, 'personal', 'low-high'))).toEqual(['p3', 'p5', 'none']);
  });
});
