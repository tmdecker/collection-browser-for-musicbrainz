import { describe, expect, it } from 'vitest';
import { albumMatchesGenreFilters, extractGenreStats, filterGenresBySearch } from '@/utils/genre-processor';
import { normalizeString } from '@/utils/string-normalization';
import { album } from './fixtures';

describe('normalizeString', () => {
  it('treats case, hyphens, underscores and extra spaces as equal', () => {
    expect(normalizeString('Hip-Hop')).toBe('hip hop');
    expect(normalizeString('  hip_hop ')).toBe('hip hop');
    expect(normalizeString('Hip   Hop')).toBe('hip hop');
  });
});

describe('extractGenreStats', () => {
  const albums = [
    album({ genres: ['Rock', 'Hip-Hop'] }),
    album({ genres: [{ name: 'hip hop' } as never, 'rock'] }),
    album({ genres: ['Jazz'], tags: ['favourite'] }),
  ];

  it('merges spelling variants and sorts by count, then name', () => {
    expect(extractGenreStats(albums).map(g => [g.normalizedName, g.count])).toEqual([
      ['hip hop', 2],
      ['rock', 2],
      ['jazz', 1],
    ]);
  });

  it('uses tags instead of genres when useGenresOnly is false', () => {
    expect(extractGenreStats(albums, false).map(g => g.name)).toEqual(['favourite']);
  });

  it('filters stats by a normalized search query', () => {
    expect(filterGenresBySearch(extractGenreStats(albums), 'HIP-hop').map(g => g.normalizedName)).toEqual(['hip hop']);
    expect(filterGenresBySearch(extractGenreStats(albums), '  ')).toHaveLength(3);
  });
});

describe('albumMatchesGenreFilters', () => {
  it('matches any selected genre regardless of spelling', () => {
    expect(albumMatchesGenreFilters(album({ genres: ['Hip-Hop'] }), ['hip hop', 'jazz'])).toBe(true);
    expect(albumMatchesGenreFilters(album({ genres: ['Rock'] }), ['jazz'])).toBe(false);
  });

  it('shows everything when no filter is selected and hides albums without genres otherwise', () => {
    expect(albumMatchesGenreFilters(album(), [])).toBe(true);
    expect(albumMatchesGenreFilters(album(), ['rock'])).toBe(false);
  });
});
