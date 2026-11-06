import { describe, expect, it } from 'vitest';
import { createSearchMatcher, parseSearchQuery, prepareSearchText } from '../search-text';

const finds = (query: string, ...fields: string[]) => {
  const matcher = createSearchMatcher(query);
  if (!matcher) throw new Error('blank query');
  return matcher(...fields);
};

describe('search-text', () => {
  it('treats a blank query as no search', () => {
    expect(createSearchMatcher('')).toBeNull();
    expect(createSearchMatcher('   ')).toBeNull();
    expect(createSearchMatcher(' - / ')).toBeNull();
    expect(parseSearchQuery('')).toEqual([]);
  });

  it('ignores case', () => {
    expect(finds('RADIOHEAD', 'Radiohead')).toBe(true);
    expect(finds('ok computer', 'OK Computer')).toBe(true);
  });

  it('ignores accents in both directions', () => {
    expect(finds('beyonce', 'Beyoncé')).toBe(true);
    expect(finds('Beyoncé', 'Beyonce')).toBe(true);
    expect(finds('sigur ros', 'Sigur Rós')).toBe(true);
    expect(finds('bjork', 'Björk')).toBe(true);
  });

  it('matches German umlauts written either way', () => {
    expect(finds('motorhead', 'Motörhead')).toBe(true);
    expect(finds('motoerhead', 'Motörhead')).toBe(true);
    expect(finds('Motörhead', 'Motorhead')).toBe(true);
    expect(finds('ärzte', 'Die Ärzte')).toBe(true);
    expect(finds('aerzte', 'Die Ärzte')).toBe(true);
    expect(finds('Ärzte', 'Die Aerzte')).toBe(true);
    expect(finds('strasse', 'Straße')).toBe(true);
    expect(finds('straße', 'Strasse')).toBe(true);
  });

  it('matches decomposed accents (as typed on some keyboards)', () => {
    expect(finds('motörhead', 'Motörhead')).toBe(true);
    expect(finds('motorhead', 'Motörhead')).toBe(true);
  });

  it('folds letters without an accent mark', () => {
    expect(finds('royksopp', 'Røyksopp')).toBe(true);
    expect(finds('aether', 'Æther')).toBe(true);
  });

  it('ignores punctuation', () => {
    expect(finds('dont', "Don't Stop")).toBe(true);
    expect(finds("don't", 'Dont Stop')).toBe(true);
    expect(finds('dont', 'Don’t Stop')).toBe(true);
    expect(finds('ac dc', 'AC/DC')).toBe(true);
    expect(finds('hip hop', 'hip-hop')).toBe(true);
    expect(finds('hip-hop', 'Hip Hop')).toBe(true);
  });

  it('matches each word on its own, across fields and in any order', () => {
    expect(finds('beatles abbey', 'Abbey Road', 'The Beatles')).toBe(true);
    expect(finds('road abbey', 'Abbey Road')).toBe(true);
    expect(finds('beatles 1969', 'Abbey Road', 'The Beatles', '1969-09-26')).toBe(true);
    expect(finds('beatles revolver', 'Abbey Road', 'The Beatles')).toBe(false);
  });

  it('still matches inside words', () => {
    expect(finds('head', 'Radiohead')).toBe(true);
    expect(finds('19', '1969-09-26')).toBe(true);
  });

  it('skips empty fields', () => {
    expect(finds('abbey', 'Abbey Road', undefined as unknown as string)).toBe(true);
  });

  it('does not forgive typos', () => {
    expect(finds('radiohaed', 'Radiohead')).toBe(false);
  });

  it('keeps non-Latin scripts', () => {
    expect(finds('坂本', '坂本龍一')).toBe(true);
    expect(prepareSearchText('Кино').plain).toBe('кино');
  });
});
