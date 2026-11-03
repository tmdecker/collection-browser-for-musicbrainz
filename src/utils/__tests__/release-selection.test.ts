import { describe, expect, it } from 'vitest';
import { extractTracksFromMedia, findBestStreamingRelease, orderReleasesForStreaming, selectPreferredRelease } from '@/utils/release-selection';
import { Media, Release } from '@/types/music';

const release = (overrides: Partial<Release>): Release => ({ id: 'r', title: 'Album', ...overrides }) as Release;
const digital = [{ format: 'Digital Media' }] as Media[];
const cd = [{ format: 'CD' }] as Media[];

describe('selectPreferredRelease', () => {
  it('prefers the oldest official release', () => {
    const releases = [
      release({ id: 'bootleg', status: 'Bootleg', date: '1990' }),
      release({ id: 'reissue', status: 'Official', date: '2011-05-02' }),
      release({ id: 'original', status: 'Official', date: '1997-05-21' }),
      release({ id: 'undated', status: 'Official' }),
    ];
    expect(selectPreferredRelease(releases)?.id).toBe('original');
  });

  it('ranks a year-only date after a full date in the same year', () => {
    const releases = [
      release({ id: 'year-only', status: 'Official', date: '1959' }),
      release({ id: 'full-date', status: 'Official', date: '1959-08-17' }),
    ];
    expect(selectPreferredRelease(releases)?.id).toBe('full-date');
  });

  it('prefers the most common track count over an odd older release', () => {
    const tracks = (...counts: number[]) => counts.map(count => ({ 'track-count': count })) as unknown as Media[];
    const releases = [
      release({ id: 'partial-tape', status: 'Official', date: '1959', media: tracks(3) }),
      release({ id: 'lp', status: 'Official', date: '1959-08-17', media: tracks(5) }),
      release({ id: 'tape', status: 'Official', date: '1959', media: tracks(5) }),
      release({ id: 'cd', status: 'Official', date: '1987', media: tracks(5) }),
      release({ id: 'legacy', status: 'Official', date: '1958', media: tracks(6, 15) }),
    ];
    expect(selectPreferredRelease(releases)?.id).toBe('lp');
  });

  it('breaks a track count tie with the oldest release', () => {
    const tracks = (count: number) => [{ 'track-count': count }] as unknown as Media[];
    const releases = [
      release({ id: 'deluxe', status: 'Official', date: '2010', media: tracks(14) }),
      release({ id: 'original', status: 'Official', date: '2000', media: tracks(10) }),
    ];
    expect(selectPreferredRelease(releases)?.id).toBe('original');
  });

  it('falls back to any release when none is official, and null for none', () => {
    expect(selectPreferredRelease([release({ id: 'promo', status: 'Promotion', date: '2001' })])?.id).toBe('promo');
    expect(selectPreferredRelease([])).toBeNull();
  });
});

describe('findBestStreamingRelease', () => {
  it('prefers Digital Media + worldwide, then digital, then worldwide', () => {
    const xwCd = release({ id: 'xw-cd', country: 'XW', media: cd });
    const deDigital = release({ id: 'de-digital', country: 'DE', media: digital });
    const xwDigital = release({ id: 'xw-digital', country: 'XW', media: digital });

    expect(findBestStreamingRelease([xwCd, deDigital, xwDigital])?.id).toBe('xw-digital');
    expect(findBestStreamingRelease([xwCd, deDigital])?.id).toBe('de-digital');
    expect(findBestStreamingRelease([xwCd])?.id).toBe('xw-cd');
    expect(findBestStreamingRelease([release({ country: 'GB', media: cd })])).toBeNull();
  });
});

describe('extractTracksFromMedia', () => {
  it('flattens tracks across discs', () => {
    const media = [
      { format: 'CD', tracks: [{ id: 't1' }, { id: 't2' }] },
      { format: 'CD', tracks: [{ id: 't3' }] },
      { format: 'CD' },
    ] as unknown as Media[];
    expect(extractTracksFromMedia(media).map(t => (t as { id: string }).id)).toEqual(['t1', 't2', 't3']);
  });
});

describe('orderReleasesForStreaming', () => {
  it('puts Digital Media first, then XW, then the rest, newest first and undated last', () => {
    const releases = [
      release({ id: 'cd-de-undated', country: 'DE', media: cd }),
      release({ id: 'cd-de-old', country: 'DE', date: '1999', media: cd }),
      release({ id: 'cd-xw', country: 'XW', date: '2001', media: cd }),
      release({ id: 'digital-old', country: 'GB', date: '2010', media: digital }),
      release({ id: 'cd-de-new', country: 'DE', date: '2020', media: cd }),
      release({ id: 'digital-new', date: '2015', media: digital }),
    ];
    expect(orderReleasesForStreaming(releases).map(r => r.id)).toEqual([
      'digital-new', 'digital-old', 'cd-xw', 'cd-de-new', 'cd-de-old', 'cd-de-undated',
    ]);
  });
});
