/**
 * @ai-file utility
 * @ai-description Official homepage of a MusicBrainz series, for the link in the series footnote
 * @ai-features
 * - Picks the series' "official homepage" URL relationship, preferring one that hasn't ended
 * - Short domain for the link text ("bluenote.com", without "www.")
 * - Remembered in this browser for a week, so opening a series doesn't cost an extra MusicBrainz request each time
 */

const STORAGE_KEY = 'mb-series-homepages';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface UrlRelation {
  type?: string;
  'target-type'?: string;
  ended?: boolean;
  url?: { resource?: string };
}

interface CachedHomepage {
  url: string | null;
  fetchedAt: number;
}

/** The series' official homepage from its url-rels, or null when it has none */
export function pickOfficialHomepage(relations: UrlRelation[] | undefined): string | null {
  const homepages = (relations ?? []).filter(
    r => r.type === 'official homepage' && r['target-type'] === 'url' && /^https?:\/\//i.test(r.url?.resource ?? '')
  );
  const current = homepages.find(r => !r.ended) ?? homepages[0];
  return current?.url?.resource ?? null;
}

/** "https://www.bluenote.com/tone-poet/" -> "bluenote.com" */
export function homepageDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

const readAll = (): Record<string, CachedHomepage> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, CachedHomepage>;
  } catch {
    return {};
  }
};

/** Remembered homepage: a string or null (none) when known and fresh, undefined when it must be looked up */
export function readCachedHomepage(seriesId: string, now = Date.now()): string | null | undefined {
  const entry = readAll()[seriesId];
  if (!entry || now - entry.fetchedAt > MAX_AGE_MS) return undefined;
  return entry.url;
}

export function writeCachedHomepage(seriesId: string, url: string | null) {
  try {
    const all = readAll();
    all[seriesId] = { url, fetchedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: looked up again next time
  }
}

/** Looks up the series' url-rels through the MusicBrainz proxy; throws when the lookup fails */
export async function fetchSeriesHomepage(seriesId: string, signal?: AbortSignal): Promise<string | null> {
  const response = await fetch(`/api/musicbrainz/series/${seriesId}?fmt=json&inc=url-rels`, { signal });
  if (!response.ok) throw new Error(`Series lookup failed: ${response.status}`);
  const data = (await response.json()) as { relations?: UrlRelation[] };
  return pickOfficialHomepage(data.relations);
}
