/**
 * @ai-file lib
 * @ai-description Review links of an album: the "review" URL relationships from its MusicBrainz external links
 * @ai-dependencies musicbrainz-fetch, release-group-cache, review-links-cache, safe-page-fetch
 * @ai-features
 * - Review URLs from the cached release group (fetched with url-rels); albums cached before that get them
 *   with one small MusicBrainz request (url-rels only), kept for 30 days
 * - Each review page is opened once (cached 90 days) for its language (html lang, then og:locale) and to
 *   leave out pages that are gone (404/410); 403 and network errors keep the link (sites that block scripts)
 * - Language fallback when the page says nothing or refuses: a short list of known sites, then the domain ending
 * - Site names for common review sites, else the hostname; web.archive.org links name the original site
 * - Concurrent requests for the same album share one lookup
 */

import { releaseGroupCache } from './cache/release-group-cache';
import { reviewPageCache, reviewUrlsCache, type ReviewPageInfo } from './cache/review-links-cache';
import { MB_BASE_URL, musicBrainzFetch } from './musicbrainz-fetch';
import { fetchPublicPageStart } from './safe-page-fetch';
import type { ReviewLink } from '@/types/reviews';

interface UrlRelation {
  type?: string;
  url?: { resource?: string };
}

/** Review sites by hostname (without www.): display name and, for sites without a country domain, the language */
const KNOWN_SITES: Record<string, { name: string; language?: string }> = {
  'bbc.co.uk': { name: 'BBC Music', language: 'en' },
  'pitchfork.com': { name: 'Pitchfork', language: 'en' },
  'plattentests.de': { name: 'Plattentests.de', language: 'de' },
  'metacritic.com': { name: 'Metacritic', language: 'en' },
  'laut.de': { name: 'laut.de', language: 'de' },
  'rollingstone.de': { name: 'Rolling Stone', language: 'de' },
  'rollingstone.com': { name: 'Rolling Stone', language: 'en' },
  'albumoftheyear.org': { name: 'Album of the Year', language: 'en' },
  'sputnikmusic.com': { name: 'Sputnikmusic', language: 'en' },
  'theguardian.com': { name: 'The Guardian', language: 'en' },
  'nme.com': { name: 'NME', language: 'en' },
  'drownedinsound.com': { name: 'Drowned in Sound', language: 'en' },
  'allmusic.com': { name: 'AllMusic', language: 'en' },
  'indielondon.co.uk': { name: 'IndieLondon', language: 'en' },
  'musicomh.com': { name: 'musicOMH', language: 'en' },
  'thequietus.com': { name: 'The Quietus', language: 'en' },
  'stereogum.com': { name: 'Stereogum', language: 'en' },
  'consequence.net': { name: 'Consequence', language: 'en' },
  'popmatters.com': { name: 'PopMatters', language: 'en' },
  'slantmagazine.com': { name: 'Slant Magazine', language: 'en' },
  'avclub.com': { name: 'The A.V. Club', language: 'en' },
  'ew.com': { name: 'Entertainment Weekly', language: 'en' },
  'spin.com': { name: 'Spin', language: 'en' },
  'npr.org': { name: 'NPR', language: 'en' },
  'clashmusic.com': { name: 'Clash', language: 'en' },
  'uncut.co.uk': { name: 'Uncut', language: 'en' },
  'exclaim.ca': { name: 'Exclaim!', language: 'en' },
  'tinymixtapes.com': { name: 'Tiny Mix Tapes', language: 'en' },
  'cokemachineglow.com': { name: 'Cokemachineglow', language: 'en' },
  'absolutepunk.net': { name: 'AbsolutePunk', language: 'en' },
  'musikexpress.de': { name: 'Musikexpress', language: 'de' },
  'visions.de': { name: 'VISIONS', language: 'de' },
  'intro.de': { name: 'Intro', language: 'de' },
  'spex.de': { name: 'Spex', language: 'de' },
  'ox-fanzine.de': { name: 'Ox-Fanzine', language: 'de' },
  'lesinrocks.com': { name: 'Les Inrocks', language: 'fr' },
  'ondarock.it': { name: 'OndaRock', language: 'it' },
};

/** Country domains whose sites are almost always in one language (.ch, .be, .ca are left out on purpose) */
const DOMAIN_LANGUAGES: Record<string, string> = {
  de: 'de', at: 'de', fr: 'fr', it: 'it', es: 'es', nl: 'nl', pt: 'pt', br: 'pt', se: 'sv', no: 'no',
  dk: 'da', fi: 'fi', pl: 'pl', cz: 'cs', jp: 'ja', ru: 'ru', hu: 'hu', gr: 'el', tr: 'tr',
  uk: 'en', us: 'en', au: 'en', nz: 'en', ie: 'en',
};

const REVIEW_PAGE_TTL_SECONDS = 90 * 24 * 60 * 60;
// A page that could not be reached is tried again the next day
const REVIEW_PAGE_FAILURE_TTL_SECONDS = 24 * 60 * 60;
const PAGE_CHECKS_AT_ONCE = 4;

const hostOf = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m)\./, '');

/** The original URL of a web.archive.org link (null for any other link) */
export function archivedOriginal(url: URL): URL | null {
  if (hostOf(url) !== 'web.archive.org') return null;
  const match = url.pathname.match(/^\/web\/[^/]+\/(.+)$/);
  if (!match) return null;
  const original = match[1] + url.search;
  try {
    return new URL(/^https?:\/\//i.test(original) ? original : `http://${original}`);
  } catch {
    return null;
  }
}

/** Plain two- or three-letter language code from a lang attribute or locale ("en-GB", "de_DE"), else null */
export function normalizeLanguage(value: string | null | undefined): string | null {
  const code = value?.trim().toLowerCase().split(/[-_]/)[0];
  return code && /^[a-z]{2,3}$/.test(code) ? code : null;
}

/** Language from the start of an HTML page: the html lang attribute, then og:locale */
export function languageFromHtml(html: string): string | null {
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0];
  const lang = htmlTag?.match(/\blang\s*=\s*["']?([A-Za-z_-]+)/i)?.[1];
  if (normalizeLanguage(lang)) return normalizeLanguage(lang);
  const ogLocale =
    html.match(/<meta[^>]+property\s*=\s*["']og:locale["'][^>]*content\s*=\s*["']([^"']+)/i)?.[1] ??
    html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:locale["']/i)?.[1];
  return normalizeLanguage(ogLocale);
}

/** Language from what is known about the site: the known-sites list, then the domain ending */
export function languageFromSite(host: string): string | null {
  const known = KNOWN_SITES[host]?.language;
  if (known) return known;
  return DOMAIN_LANGUAGES[host.split('.').pop() ?? ''] ?? null;
}

export function siteName(host: string): string {
  return KNOWN_SITES[host]?.name ?? host;
}

/** Review URLs of the album: from the cached release group when it has url-rels, else one MusicBrainz request */
async function reviewUrlsOf(mbid: string): Promise<string[]> {
  const cachedGroup = releaseGroupCache.get(mbid) as { relations?: UrlRelation[] } | undefined;
  if (Array.isArray(cachedGroup?.relations)) return reviewUrlsFrom(cachedGroup.relations);

  const cached = reviewUrlsCache.getFresh(mbid);
  if (cached) return cached.urls;

  const response = await musicBrainzFetch(`${MB_BASE_URL}/release-group/${mbid}?fmt=json&inc=url-rels`, { priority: 'high' });
  if (!response.ok) {
    await response.body?.cancel();
    // A stale list is better than none while MusicBrainz is busy
    const stale = reviewUrlsCache.get(mbid);
    if (stale) return stale.urls;
    throw new Error(`MusicBrainz answered ${response.status}`);
  }
  const data = (await response.json()) as { relations?: UrlRelation[] };
  const urls = reviewUrlsFrom(data.relations ?? []);
  reviewUrlsCache.set(mbid, { urls });
  return urls;
}

export function reviewUrlsFrom(relations: UrlRelation[]): string[] {
  const urls = relations
    .filter(relation => relation.type === 'review' && typeof relation.url?.resource === 'string')
    .map(relation => relation.url!.resource!);
  return [...new Set(urls)];
}

/** Language and status of one review page, from the cache or by opening it once */
async function pageInfo(url: string): Promise<ReviewPageInfo> {
  const cached = reviewPageCache.getFresh(url);
  if (cached) return cached;
  const result = await fetchPublicPageStart(url);
  const info: ReviewPageInfo = {
    status: result.status,
    language: result.html ? languageFromHtml(result.html) : null,
  };
  // Pages that answered are kept 90 days; unreachable ones (status null, 429, 5xx) only a day
  const answered = info.status !== null && info.status < 500 && info.status !== 429;
  reviewPageCache.set(url, info, answered ? REVIEW_PAGE_TTL_SECONDS : REVIEW_PAGE_FAILURE_TTL_SECONDS);
  return info;
}

async function buildReviewLink(resource: string): Promise<ReviewLink | null> {
  let url: URL;
  try {
    url = new URL(resource);
  } catch {
    return null;
  }
  const original = archivedOriginal(url);
  const host = hostOf(original ?? url);

  let pageLanguage: string | null = null;
  // Archived pages are not opened (they exist by definition, and the Wayback Machine limits scripts)
  if (!original) {
    const info = await pageInfo(resource);
    if (info.status === 404 || info.status === 410) return null;
    pageLanguage = info.language;
  }

  return {
    url: resource,
    site: siteName(host),
    host,
    language: pageLanguage ?? languageFromSite(host),
    archived: !!original,
  };
}

/** Run fn over items with at most `limit` running at once, keeping the order */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const running = new Map<string, Promise<ReviewLink[]>>();

/**
 * The album's review links in MusicBrainz order (dead pages left out); throws when MusicBrainz could not be asked
 */
export function getReviewLinks(mbid: string): Promise<ReviewLink[]> {
  let lookup = running.get(mbid);
  if (!lookup) {
    lookup = (async () => {
      const urls = await reviewUrlsOf(mbid);
      const links = await mapLimited(urls, PAGE_CHECKS_AT_ONCE, buildReviewLink);
      return links.filter((link): link is ReviewLink => link !== null);
    })().finally(() => running.delete(mbid));
    running.set(mbid, lookup);
  }
  return lookup;
}

/** Forget the album's review URLs (manual album refresh); page languages stay cached per URL */
export function deleteReviewUrls(mbid: string): void {
  reviewUrlsCache.delete(mbid);
}
