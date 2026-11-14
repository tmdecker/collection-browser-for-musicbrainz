import { describe, expect, it } from 'vitest';
import { browserReviewLanguages, effectiveReviewLanguages, joinLanguageNames, splitReviewLinks } from '@/utils/review-languages';
import type { ReviewLink } from '@/types/reviews';

const link = (site: string, language: string | null): ReviewLink => ({
  url: `https://${site}/review`, site, host: site, language, archived: false,
});

describe('browserReviewLanguages', () => {
  it('turns the browser languages into plain codes and adds English at the end', () => {
    expect(browserReviewLanguages(['de-DE', 'de', 'fr-CH'])).toEqual(['de', 'fr', 'en']);
  });

  it('keeps English where the browser has it', () => {
    expect(browserReviewLanguages(['en-GB', 'de-DE', 'en-US'])).toEqual(['en', 'de']);
  });

  it('falls back to English and treats Bokmål as Norwegian', () => {
    expect(browserReviewLanguages(undefined)).toEqual(['en']);
    expect(browserReviewLanguages(['nb-NO', 'nn'])).toEqual(['no', 'en']);
  });
});

describe('effectiveReviewLanguages', () => {
  it('follows the browser while that is ticked, else the own list', () => {
    expect(effectiveReviewLanguages({ useBrowserLanguages: true, languages: ['fr'] }, ['de'])).toEqual(['de', 'en']);
    expect(effectiveReviewLanguages({ useBrowserLanguages: false, languages: ['fr'] }, ['de'])).toEqual(['fr']);
    expect(effectiveReviewLanguages({ useBrowserLanguages: false, languages: [] }, ['de'])).toEqual(['de', 'en']);
  });
});

describe('splitReviewLinks', () => {
  it('shows the user languages in list order, then unknown, and keeps the rest apart', () => {
    const links = [link('bbc.co.uk', 'en'), link('soundi.fi', 'fi'), link('laut.de', 'de'), link('example.org', null), link('lesinrocks.com', 'fr')];
    const { shown, other } = splitReviewLinks(links, ['de', 'en']);
    expect(shown.map(l => l.site)).toEqual(['laut.de', 'bbc.co.uk', 'example.org']);
    expect(other.map(l => l.site)).toEqual(['soundi.fi', 'lesinrocks.com']);
  });

  it('puts every link in other when none matches', () => {
    const { shown, other } = splitReviewLinks([link('soundi.fi', 'fi')], ['de', 'en']);
    expect(shown).toEqual([]);
    expect(other).toHaveLength(1);
  });
});

describe('joinLanguageNames', () => {
  it('names languages in English', () => {
    expect(joinLanguageNames(['de'], 'or')).toBe('German');
    expect(joinLanguageNames(['de', 'en'], 'or')).toBe('German or English');
    expect(joinLanguageNames(['de', 'en', 'fr'], 'and')).toBe('German, English and French');
  });
});
