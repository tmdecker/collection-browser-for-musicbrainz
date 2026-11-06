/**
 * @ai-file utility
 * @ai-description Forgiving text matching shared by every search box in the app
 * @ai-dependencies None (pure utility)
 * @ai-features
 * - Ignores case and accents: "beyonce" finds "Beyoncé", "motorhead" finds "Motörhead"
 * - German spellings both ways: "ae/oe/ue/ss" and "ä/ö/ü/ß" match each other ("Die Aerzte" ↔ "Ärzte")
 * - Letters without a decomposed form folded too (æ, œ, ø, ł, đ, þ)
 * - Punctuation ignored: apostrophes vanish ("dont" finds "Don't"), other symbols act as spaces
 * - Each word of the query matches on its own, anywhere in the text: "beatles abbey" finds Abbey Road by The Beatles
 * - No typo tolerance on purpose
 */

/** Text prepared for matching: two spellings of the same text */
export interface SearchText {
  /** Umlauts reduced to their base letter: "motorhead" */
  plain: string;
  /** Umlauts written out the German way: "motoerhead" */
  expanded: string;
}

const GERMAN_UMLAUTS: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' };

// Letters that NFD does not split into base letter + accent
const SPECIAL_LETTERS: Record<string, string> = {
  'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i',
};

// Unicode property escapes need the u flag, which TypeScript's ES5 target rejects in regex literals
const COMBINING_MARKS = new RegExp('\\p{M}', 'gu');
const NON_WORD = new RegExp('[^\\p{L}\\p{N}]+', 'gu');

const fold = (text: string, expandUmlauts: boolean): string => {
  let result = text.toLowerCase();
  if (expandUmlauts) {
    // Precomposed and decomposed forms ("ä" and "a" + combining diaeresis)
    result = result.normalize('NFC').replace(/[äöü]/g, ch => GERMAN_UMLAUTS[ch]);
  }
  return result
    .replace(/[ßæœøłđðþı]/g, ch => SPECIAL_LETTERS[ch])
    .normalize('NFD')
    .replace(COMBINING_MARKS, '') // accents and other combining marks
    .replace(/['’‘`´]/g, '') // apostrophes join the word: "don't" → "dont"
    .replace(NON_WORD, ' ') // any other symbol separates words
    .trim();
};

/** Prepares text (an album title, a name) once, so it can be matched against many queries */
export const prepareSearchText = (text: string): SearchText => ({
  plain: fold(text, false),
  expanded: fold(text, true),
});

/** The words of a query, each prepared on its own; empty for a blank query */
export const parseSearchQuery = (query: string): SearchText[] => {
  // Expanding umlauts never adds or removes spaces, so both spellings split into the same words
  const { plain, expanded } = prepareSearchText(query);
  if (!plain) return [];
  const expandedWords = expanded.split(' ');
  return plain.split(' ').map((word, i) => ({ plain: word, expanded: expandedWords[i] ?? word }));
};

const wordMatches = (text: SearchText, word: SearchText): boolean =>
  text.plain.includes(word.plain) ||
  text.expanded.includes(word.plain) ||
  text.plain.includes(word.expanded) ||
  text.expanded.includes(word.expanded);

/** True when every word of the query appears somewhere in the text */
export const matchesSearch = (text: SearchText, words: SearchText[]): boolean =>
  words.every(word => wordMatches(text, word));

/**
 * A reusable test for one query, or null for a blank query (show everything).
 * Several fields can be passed at once; the words may then be spread across them.
 */
export const createSearchMatcher = (query: string): ((...fields: (string | undefined | null)[]) => boolean) | null => {
  const words = parseSearchQuery(query);
  if (words.length === 0) return null;
  return (...fields) => matchesSearch(prepareSearchText(fields.filter(Boolean).join(' ')), words);
};
