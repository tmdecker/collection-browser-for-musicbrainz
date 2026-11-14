/**
 * @ai-file utils
 * @ai-description Review languages: the default from the browser, and sorting review links by the user's languages
 * @ai-dependencies ReviewLink type, Intl.DisplayNames
 * @ai-features
 * - Default: the browser's languages (navigator.languages) as plain codes, English added at the end
 * - Links in the user's languages first (in list order), then links of unknown language; the rest are "other"
 * - Language names in their own language ("Deutsch") for Settings, in English ("German") for the panel text
 */

import type { ReviewLink } from '@/types/reviews';

/** Languages offered in Settings (any others the user already has are listed too) */
export const OFFERED_REVIEW_LANGUAGES = ['en', 'de', 'fr', 'it', 'es', 'nl', 'pt', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'ja'];

const languageCode = (tag: string): string | null => {
  const code = tag.trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(code) ? code : null;
};

/** The browser's languages as plain codes, without duplicates, English always included (last if missing) */
export function browserReviewLanguages(browserLanguages: readonly string[] | undefined): string[] {
  const codes: string[] = [];
  for (const tag of browserLanguages ?? []) {
    const code = languageCode(tag);
    // Norwegian Bokmål and Nynorsk read the same reviews
    const normalized = code === 'nb' || code === 'nn' ? 'no' : code;
    if (normalized && !codes.includes(normalized)) codes.push(normalized);
  }
  if (!codes.includes('en')) codes.push('en');
  return codes;
}

/** The languages in effect: the browser's while "Use my browser's languages" is on, else the user's list */
export function effectiveReviewLanguages(
  preferences: { useBrowserLanguages: boolean; languages: string[] },
  browserLanguages: readonly string[] | undefined
): string[] {
  if (preferences.useBrowserLanguages || preferences.languages.length === 0) return browserReviewLanguages(browserLanguages);
  return preferences.languages;
}

/**
 * Split links into those to show (the user's languages in list order, then unknown language) and the rest
 * (grouped by language, in order of first appearance)
 */
export function splitReviewLinks(links: ReviewLink[], languages: string[]): { shown: ReviewLink[]; other: ReviewLink[] } {
  const rank = (link: ReviewLink) => {
    if (link.language === null) return languages.length; // unknown: after the user's languages
    const index = languages.indexOf(link.language);
    return index === -1 ? Infinity : index;
  };
  const shown = links.filter(link => rank(link) !== Infinity).sort((a, b) => rank(a) - rank(b));
  const otherLanguages = [...new Set(links.filter(link => rank(link) === Infinity).map(link => link.language!))];
  const other = links
    .filter(link => rank(link) === Infinity)
    .sort((a, b) => otherLanguages.indexOf(a.language!) - otherLanguages.indexOf(b.language!));
  return { shown, other };
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** Name of a language in English ("German"), the code itself when the browser has no name for it */
export function languageNameInEnglish(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Name of a language in that language ("Deutsch"), for the Settings list */
export function languageNameNative(code: string): string {
  try {
    return capitalize(new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code);
  } catch {
    return code;
  }
}

/** "German", "German or English", "German, English or French" */
export function joinLanguageNames(codes: string[], conjunction: 'or' | 'and'): string {
  const names = codes.map(languageNameInEnglish);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${conjunction} ${names[names.length - 1]}`;
}
