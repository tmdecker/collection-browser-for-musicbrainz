import { describe, expect, it } from 'vitest';
import { artistSortName, sortByArtist } from '../artist-sort';
import { ReleaseGroup } from '@/types/music';

const album = (title: string, name: string, sortName: string | undefined, date: string): ReleaseGroup => ({
  id: title,
  title,
  first_release_date: date,
  artist_credit: [{ name, joinphrase: '', artist: { id: name, name, ...(sortName ? { 'sort-name': sortName } : {}) } as never }],
} as unknown as ReleaseGroup);

const lowAndBlackstar = [
  album('Blackstar', 'David Bowie', 'Bowie, David', '2016-01-08'),
  album('Low', 'David Bowie', 'Bowie, David', '1977-01-14'),
];
const vu = album('The Velvet Underground & Nico', 'The Velvet Underground', 'Velvet Underground, The', '1967-03-12');
const cure = album('Disintegration', 'The Cure', 'Cure, The', '1989-05-02');
const noSortName = album('Tago Mago', 'Can', undefined, '1971-08');

describe('artistSortName', () => {
  it('uses the MusicBrainz sort name, else the display name', () => {
    expect(artistSortName(vu)).toBe('Velvet Underground, The');
    expect(artistSortName(noSortName)).toBe('Can');
  });
});

describe('sortByArtist', () => {
  const albums = [vu, ...lowAndBlackstar, cure, noSortName];

  it('sorts by sort name, so "The" and first names do not decide', () => {
    expect(sortByArtist(albums, 'asc').map(a => a.title)).toEqual([
      'Low', 'Blackstar', 'Tago Mago', 'Disintegration', 'The Velvet Underground & Nico',
    ]);
  });

  it('keeps an artist\'s albums oldest first when sorting Z to A', () => {
    expect(sortByArtist(albums, 'desc').map(a => a.title)).toEqual([
      'The Velvet Underground & Nico', 'Disintegration', 'Tago Mago', 'Low', 'Blackstar',
    ]);
  });
});
