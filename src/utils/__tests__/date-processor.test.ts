import { describe, expect, it } from 'vitest';
import { albumMatchesDateFilter, extractYear, getAvailableYearRange } from '@/utils/date-processor';
import { album } from './fixtures';

describe('extractYear', () => {
  it('reads the year from full, partial and year-only dates', () => {
    expect(extractYear('1977-09-23')).toBe(1977);
    expect(extractYear('1977-09')).toBe(1977);
    expect(extractYear('1977')).toBe(1977);
  });

  it('returns null for missing, malformed and out-of-range dates', () => {
    expect(extractYear(undefined)).toBeNull();
    expect(extractYear('')).toBeNull();
    expect(extractYear('unknown')).toBeNull();
    expect(extractYear('1899-12-31')).toBeNull();
  });
});

describe('getAvailableYearRange', () => {
  it('ignores albums without a valid date', () => {
    const albums = [
      album({ first_release_date: '1991-09-24' }),
      album({ first_release_date: undefined }),
      album({ first_release_date: '1967' }),
    ];
    expect(getAvailableYearRange(albums)).toEqual({ min: 1967, max: 1991 });
  });

  it('returns null when no album has a date', () => {
    expect(getAvailableYearRange([album()])).toBeNull();
  });
});

describe('albumMatchesDateFilter', () => {
  it('is inclusive on both ends and excludes undated albums', () => {
    expect(albumMatchesDateFilter(album({ first_release_date: '1970' }), 1970, 1979)).toBe(true);
    expect(albumMatchesDateFilter(album({ first_release_date: '1979-12-31' }), 1970, 1979)).toBe(true);
    expect(albumMatchesDateFilter(album({ first_release_date: '1980' }), 1970, 1979)).toBe(false);
    expect(albumMatchesDateFilter(album(), 1900, 2100)).toBe(false);
  });
});
