import { describe, expect, it } from 'vitest';
import { formatGroupOf, releaseFormat, sortReleasesByDate, summarizeRelease } from '../release-summary';
import { Release } from '@/types/music';

const release = (overrides: Partial<Release> & Record<string, unknown>): Release => ({ id: 'r', title: 'T', ...overrides } as Release);

describe('releaseFormat', () => {
  it('counts media of the same format', () => {
    expect(releaseFormat(release({ media: [{ position: 1, format: 'CD', track_count: 9 }, { position: 2, format: 'CD', track_count: 3 }] }))).toBe('2×CD');
  });
  it('joins different formats and uses the inch sign', () => {
    expect(releaseFormat(release({ media: [{ position: 1, format: '12" Vinyl', track_count: 9 }, { position: 2, format: 'DVD-Video', track_count: 1 }] }))).toBe('12″ Vinyl + DVD-Video');
  });
  it('says so when there is no format', () => {
    expect(releaseFormat(release({ media: [] }))).toBe('Unknown format');
  });
});

describe('formatGroupOf', () => {
  it.each([
    ['12″ Vinyl', 'Vinyl'], ['2×CD', 'CD'], ['Enhanced CD', 'CD'], ['SACD', 'CD'],
    ['Digital Media', 'Digital'], ['Cassette', 'Cassette'], ['DVD-Video', 'Other'],
  ])('%s is %s', (format, group) => {
    expect(formatGroupOf(format)).toBe(group);
  });
});

describe('summarizeRelease', () => {
  it('collects labels, catalogue numbers, tracks and an unofficial status', () => {
    const summary = summarizeRelease(release({
      date: '1971-05-21', country: 'US', status: 'Promotion',
      media: [{ position: 1, format: '12" Vinyl', track_count: 0, 'track-count': 9 } as never],
      'label-info': [
        { label: { id: 'l', name: 'Tamla' }, 'catalog-number': 'TS 310' },
        { label: { id: 'l', name: 'Tamla' }, 'catalog-number': 'TS 310' },
      ],
    }));
    expect(summary).toMatchObject({ year: '1971', format: '12″ Vinyl', formatGroup: 'Vinyl', label: 'Tamla', catalogNumber: 'TS 310', tracks: 9, unofficialStatus: 'Promotion' });
  });
  it('has no status for official releases', () => {
    expect(summarizeRelease(release({ status: 'Official' })).unofficialStatus).toBeNull();
  });
});

describe('sortReleasesByDate', () => {
  it('puts the oldest first and undated last', () => {
    const sorted = sortReleasesByDate([
      summarizeRelease(release({ id: 'c' })),
      summarizeRelease(release({ id: 'b', date: '1985' })),
      summarizeRelease(release({ id: 'a', date: '1971-05-21' })),
    ]);
    expect(sorted.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });
});
