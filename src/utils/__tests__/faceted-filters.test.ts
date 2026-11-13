import { describe, expect, it } from 'vitest';
import { ReleaseGroup } from '@/types/music';
import { albumMatchesSelection, facetedStats, type FilterSelection } from '../faceted-filters';

const album = (id: string, genres: string[], tags: string[], label?: string): ReleaseGroup => ({
  id,
  title: id,
  genres: genres.map(name => ({ name, count: 1 })),
  tags: tags.map(name => ({ name, count: 1 })),
  releaseDetails: label ? { 'label-info': [{ label: { name: label } }] } : undefined,
} as unknown as ReleaseGroup);

const albums = [
  album('mezzanine', ['trip hop', 'electronic'], ['british', 'dark'], 'Virgin'),
  album('dummy', ['trip hop'], ['british'], 'Go! Beat'),
  album('homogenic', ['electronic', 'trip hop'], ['icelandic'], 'One Little Indian'),
  album('kind-of-blue', ['jazz'], ['50s'], 'Columbia'),
];

const none: FilterSelection = { genres: [], labels: [], tags: [], dateRange: null, ratingRange: null };
const count = (stats: { name: string; count: number }[], name: string) => stats.find(s => s.name === name)?.count;

describe('facetedStats', () => {
  it('counts the whole list when nothing is selected', () => {
    const { genreStats, tagStats } = facetedStats(albums, none);
    expect(count(genreStats, 'trip hop')).toBe(3);
    expect(count(tagStats, 'british')).toBe(2);
  });

  it('counts genres within the albums the other kinds of filters leave', () => {
    const { genreStats } = facetedStats(albums, { ...none, tags: ['british'] });
    expect(count(genreStats, 'trip hop')).toBe(2);
    expect(count(genreStats, 'electronic')).toBe(1);
    // No british jazz album: the chip is left out
    expect(count(genreStats, 'jazz')).toBeUndefined();
  });

  it('keeps genres "any of": a selected genre does not shrink the other genre counts', () => {
    const { genreStats, tagStats } = facetedStats(albums, { ...none, genres: ['jazz'] });
    expect(count(genreStats, 'trip hop')).toBe(3);
    // Tags follow the genre filter
    expect(count(tagStats, '50s')).toBe(1);
    expect(count(tagStats, 'british')).toBeUndefined();
  });

  it('keeps a selected chip first, at 0 when no album is left for it', () => {
    const { genreStats } = facetedStats(albums, { ...none, genres: ['jazz'], tags: ['british'] });
    expect(genreStats[0]).toMatchObject({ name: 'jazz', count: 0 });
  });

  it('counts labels the same way', () => {
    const { labelStats } = facetedStats(albums, { ...none, genres: ['electronic'] });
    expect(labelStats.map(l => l.name).sort()).toEqual(['One Little Indian', 'Virgin']);
    const tagged = facetedStats(albums, { ...none, tags: ['icelandic'] });
    expect(tagged.labelStats).toEqual([{ name: 'One Little Indian', count: 1 }]);
  });
});

describe('albumMatchesSelection', () => {
  it('needs every kind to match, any value within a kind', () => {
    const selection = { ...none, genres: ['jazz', 'trip hop'], tags: ['british'] };
    expect(albums.filter(a => albumMatchesSelection(a, selection)).map(a => a.id)).toEqual(['mezzanine', 'dummy']);
  });
});
