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
