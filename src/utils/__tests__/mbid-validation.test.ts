import { describe, expect, it } from 'vitest';
import { extractMbidFromUrl, isValidMbidFormat } from '@/utils/mbid-validation';

const MBID = '27a3c068-3ec5-421a-ad12-599d085fdeb1';

describe('isValidMbidFormat', () => {
  it('accepts a lowercase or uppercase MBID with surrounding whitespace', () => {
    expect(isValidMbidFormat(MBID)).toBe(true);
    expect(isValidMbidFormat(` ${MBID.toUpperCase()} `)).toBe(true);
  });

  it('rejects malformed IDs', () => {
    expect(isValidMbidFormat('')).toBe(false);
    expect(isValidMbidFormat(MBID.slice(0, -1))).toBe(false);
    expect(isValidMbidFormat(MBID.replace(/-/g, ''))).toBe(false);
    expect(isValidMbidFormat(`${MBID}x`)).toBe(false);
  });
});

describe('extractMbidFromUrl', () => {
  it('detects collection and series URLs', () => {
    expect(extractMbidFromUrl(`https://musicbrainz.org/collection/${MBID}`)).toEqual({ mbid: MBID, entityType: 'collection' });
    expect(extractMbidFromUrl(`https://musicbrainz.org/series/${MBID}`)).toEqual({ mbid: MBID, entityType: 'series' });
  });

  it('accepts URLs without scheme, with www and with trailing paths', () => {
    expect(extractMbidFromUrl(`musicbrainz.org/collection/${MBID}`)?.mbid).toBe(MBID);
    expect(extractMbidFromUrl(`http://www.musicbrainz.org/series/${MBID}/`)?.entityType).toBe('series');
    expect(extractMbidFromUrl(`https://musicbrainz.org/collection/${MBID}/own`)?.mbid).toBe(MBID);
  });

  it('returns null for bare MBIDs and other entity URLs', () => {
    expect(extractMbidFromUrl(MBID)).toBeNull();
    expect(extractMbidFromUrl(`https://musicbrainz.org/release-group/${MBID}`)).toBeNull();
  });
});
