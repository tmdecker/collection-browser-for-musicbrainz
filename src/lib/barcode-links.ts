/**
 * @ai-file utility
 * @ai-description Finds streaming links for a release by its barcode (UPC/EAN) at the platforms' own APIs
 * @ai-dependencies StreamingLinks type, THIRD_PARTY_USER_AGENT
 * @ai-features
 * - Deezer and Apple Music (iTunes lookup): no API key needed
 * - Spotify and Tidal: optional, only when client credentials are configured (server-only env vars)
 * - Access tokens are cached on globalThis until shortly before they expire
 * - Every provider has its own timeout; one failing provider never blocks the others
 * - iTunes requests are spaced 3.1 s apart (about 20 per minute allowed)
 */

import { StreamingLinks } from '@/types/music';
import { THIRD_PARTY_USER_AGENT } from '@/utils/config/userAgent';
import { createRateLimiter } from '@/lib/rate-limiter';

const REQUEST_TIMEOUT_MS = 8000;

// The iTunes lookup API allows roughly 20 requests per minute; a full prefetch would exceed that
const waitForItunesRateLimit = createRateLimiter('__itunesRateLimiterQueue', 3100).wait;

type BarcodeLinks = Pick<StreamingLinks, 'deezer' | 'appleMusic' | 'spotify' | 'tidal'>;

/**
 * Barcodes are stored with or without a leading zero (UPC-A vs EAN-13); some APIs only match one form
 */
export const barcodeVariants = (barcode: string): string[] => {
  const digits = barcode.replace(/\D/g, '');
  const variants = [digits];
  if (digits.length === 12) variants.push(`0${digits}`);
  if (digits.length === 13 && digits.startsWith('0')) variants.push(digits.slice(1));
  return variants;
};

/**
 * MusicBrainz barcodes we can look up: 8 (EAN-8), 12 (UPC-A), 13 (EAN-13) or 14 (GTIN-14) digits
 */
export const isLookupBarcode = (value: unknown): value is string =>
  typeof value === 'string' && /^(\d{8}|\d{12,14})$/.test(value);

const getJson = async <T>(url: string, init: RequestInit = {}): Promise<T | null> => {
  const response = await fetch(url, {
    ...init,
    headers: { 'User-Agent': THIRD_PARTY_USER_AGENT, Accept: 'application/json', ...init.headers },
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  return (await response.json()) as T;
};

// --- Deezer (no key) ---

const findDeezer = async (barcode: string): Promise<string | undefined> => {
  for (const variant of barcodeVariants(barcode)) {
    const album = await getJson<{ link?: string; error?: unknown }>(`https://api.deezer.com/album/upc:${variant}`);
    if (album?.link && !album.error) return album.link;
  }
  return undefined;
};

// --- Apple Music via iTunes lookup (no key) ---

const findAppleMusic = async (barcode: string, country: string): Promise<string | undefined> => {
  const url = new URL('https://itunes.apple.com/lookup');
  url.searchParams.set('upc', barcode);
  url.searchParams.set('entity', 'album');
  url.searchParams.set('country', country.toLowerCase());
  await waitForItunesRateLimit();
  const result = await getJson<{ results?: Array<{ collectionViewUrl?: string }> }>(url.toString());
  const viewUrl = result?.results?.find(item => item.collectionViewUrl)?.collectionViewUrl;
  // Drop iTunes tracking parameters (uo=4 etc.), keep the plain album URL
  return viewUrl ? viewUrl.split('?')[0] : undefined;
};

// --- Client-credentials tokens (Spotify, Tidal) ---

interface CachedToken {
  accessToken: string;
  validUntil: number;
}

const tokenStore = globalThis as typeof globalThis & { __barcodeLinkTokens?: Record<string, CachedToken> };

const getClientCredentialsToken = async (
  name: string,
  tokenUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> => {
  const tokens = (tokenStore.__barcodeLinkTokens ??= {});
  const cached = tokens[name];
  if (cached && cached.validUntil > Date.now()) return cached.accessToken;

  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId });
  const token = await getJson<{ access_token?: string; expires_in?: number }>(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!token?.access_token) {
    console.warn(`⚠️ ${name}: could not get an access token (check client ID and secret)`);
    return null;
  }

  // Renew a minute early so a request never goes out with an expired token
  tokens[name] = {
    accessToken: token.access_token,
    validUntil: Date.now() + ((token.expires_in ?? 3600) - 60) * 1000,
  };
  return token.access_token;
};

// --- Spotify (optional: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET) ---

const findSpotify = async (barcode: string, country: string): Promise<string | undefined> => {
  const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret } = process.env;
  if (!clientId || !clientSecret) return undefined;

  const token = await getClientCredentialsToken('Spotify', 'https://accounts.spotify.com/api/token', clientId, clientSecret);
  if (!token) return undefined;

  for (const variant of barcodeVariants(barcode)) {
    const url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.set('q', `upc:${variant}`);
    url.searchParams.set('type', 'album');
    url.searchParams.set('market', country);
    url.searchParams.set('limit', '1');
    const result = await getJson<{ albums?: { items?: Array<{ external_urls?: { spotify?: string } }> } }>(
      url.toString(),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const link = result?.albums?.items?.[0]?.external_urls?.spotify;
    if (link) return link;
  }
  return undefined;
};

// --- Tidal (optional: TIDAL_CLIENT_ID, TIDAL_CLIENT_SECRET) ---

const findTidal = async (barcode: string, country: string): Promise<string | undefined> => {
  const { TIDAL_CLIENT_ID: clientId, TIDAL_CLIENT_SECRET: clientSecret } = process.env;
  if (!clientId || !clientSecret) return undefined;

  const token = await getClientCredentialsToken('Tidal', 'https://auth.tidal.com/v1/oauth2/token', clientId, clientSecret);
  if (!token) return undefined;

  for (const variant of barcodeVariants(barcode)) {
    const url = new URL('https://openapi.tidal.com/v2/albums');
    url.searchParams.set('countryCode', country);
    url.searchParams.set('filter[barcodeId]', variant);
    const result = await getJson<{ data?: Array<{ id?: string }> }>(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json' },
    });
    const id = result?.data?.[0]?.id;
    if (id && /^\d+$/.test(id)) return `https://tidal.com/album/${id}`;
  }
  return undefined;
};

/**
 * Look up a barcode at all configured platforms in parallel
 * @param country - Two-letter country code (store front / market)
 * @returns Links that were found; missing platforms are simply left out
 */
export const lookupLinksByBarcode = async (barcode: string, country: string): Promise<BarcodeLinks> => {
  const lookups: Array<[keyof BarcodeLinks, Promise<string | undefined>]> = [
    ['deezer', findDeezer(barcode)],
    ['appleMusic', findAppleMusic(barcode, country)],
    ['spotify', findSpotify(barcode, country)],
    ['tidal', findTidal(barcode, country)],
  ];

  const results = await Promise.allSettled(lookups.map(([, lookup]) => lookup));
  const links: BarcodeLinks = {};
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      links[lookups[index][0]] = result.value;
    } else if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`⚠️ Barcode lookup at ${lookups[index][0]} failed for ${barcode}: ${reason}`);
    }
  });
  return links;
};

// --- Cached lookup (shared by the API route and the prefetch) ---

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Lookups in flight, so a click and the prefetch never query the same barcode twice at once
const pendingStore = globalThis as typeof globalThis & { __barcodeLookupsPending?: Map<string, Promise<BarcodeLinks>> };

/**
 * Barcode lookup through the server cache (7 days, including "nothing found")
 */
export const getBarcodeLinksCached = async (
  barcode: string,
  country: string
): Promise<{ links: StreamingLinks; fromCache: boolean }> => {
  const { streamingLinksCache } = await import('@/lib/cache/streaming-links-cache');
  // The key includes which optional providers are configured, so adding Spotify or Tidal
  // credentials later is not hidden behind results cached without them
  const providers = ['deezer', 'apple', process.env.SPOTIFY_CLIENT_ID && 'spotify', process.env.TIDAL_CLIENT_ID && 'tidal']
    .filter(Boolean)
    .join('+');
  const cacheKey = `barcode:${providers}:${barcode}`;
  const cached = streamingLinksCache.getByUrl(cacheKey, country);
  if (cached) {
    return { links: cached.streamingLinks, fromCache: true };
  }

  const pending = (pendingStore.__barcodeLookupsPending ??= new Map());
  const pendingKey = `${cacheKey}:${country}`;
  let lookup = pending.get(pendingKey);
  if (!lookup) {
    lookup = lookupLinksByBarcode(barcode, country).finally(() => pending.delete(pendingKey));
    pending.set(pendingKey, lookup);
  }

  const links = await lookup;
  const now = Date.now();
  streamingLinksCache.setByUrl(cacheKey, country, {
    streamingLinks: links,
    sourceUrl: cacheKey,
    userCountry: country,
    _cachedAt: now,
    _expiresAt: now + CACHE_TTL_MS,
  });
  console.log(`🏷️ Barcode ${barcode}: ${Object.keys(links).join(', ') || 'no links found'}`);
  return { links, fromCache: false };
};
