/**
 * @ai-file utility
 * @ai-description Streaming URL helpers (shared) and the client call for an album's streaming links
 * @ai-dependencies Release/StreamingLinks types, THIRD_PARTY_USER_AGENT
 * @ai-features
 * - Recognizes streaming platform URLs in MusicBrainz url-rels (exact host match, SSRF-safe)
 * - Server-side liveness check that only ever contacts streaming hosts
 * - Client: one request to /api/streaming-links per album; the server resolves and caches the links
 */

import { Release, StreamingLinks } from '@/types/music';
import { THIRD_PARTY_USER_AGENT } from '@/utils/config/userAgent';

// Supported streaming domain patterns for URL detection
const STREAMING_DOMAINS = [
  'open.spotify.com',
  'music.apple.com',
  'itunes.apple.com',
  'youtube.com',
  'music.youtube.com',
  'amazon.com',
  'music.amazon.com',
  'deezer.com',
  'tidal.com',
  'soundcloud.com',
  'pandora.com',
  'bandcamp.com',
];

const STREAMING_RELATION_TYPES = new Set(['streaming', 'free streaming', 'purchase for download']);

/**
 * Extracts ALL streaming URLs from a release's url-rels (streaming, free streaming, purchase for download)
 */
export const extractAllStreamingUrls = (release: Release): string[] => {
  const urls: string[] = [];

  for (const relation of release.relations ?? []) {
    const url = relation.url?.resource;
    if (STREAMING_RELATION_TYPES.has(relation.type) && url && isStreamingUrl(url)) {
      urls.push(url);
    }
  }

  return urls;
};

/**
 * Gets the platform name from a streaming URL
 */
export const getPlatformFromUrl = (url: string): keyof StreamingLinks | null => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('spotify.com')) return 'spotify';
    if (hostname.includes('apple.com') || hostname.includes('itunes.apple.com')) return 'appleMusic';
    if (hostname.includes('music.youtube.com')) return 'youtubeMusic';
    if (hostname.includes('youtube.com')) return 'youtube';
    if (hostname.includes('music.amazon.com')) return 'amazonMusic';
    if (hostname.includes('amazon.com')) return 'amazon';
    if (hostname.includes('deezer.com')) return 'deezer';
    if (hostname.includes('tidal.com')) return 'tidal';
    if (hostname.includes('soundcloud.com')) return 'soundcloud';
    if (hostname.includes('pandora.com')) return 'pandora';
    if (hostname.includes('bandcamp.com')) return 'bandcamp';

    return null;
  } catch {
    return null;
  }
};

/**
 * Checks if a URL is from a supported streaming platform
 */
export const isStreamingUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') return false;
    if (urlObj.username || urlObj.password || urlObj.port) return false;
    // Security: match the parsed hostname exactly or as a subdomain, never as a substring
    // (so "spotify.com.evil.example" or "127.0.0.1/?x=spotify.com" are rejected)
    const hostname = urlObj.hostname.toLowerCase();
    return STREAMING_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

const MAX_VALIDATION_REDIRECTS = 5;
const VALIDATION_TIMEOUT_MS = 5000;

/**
 * Requests a URL and follows redirects manually, so only streaming hosts are ever contacted
 * Returns the final status, or null if a redirect leaves the streaming hosts
 */
const fetchStreamingStatus = async (url: string, method: 'HEAD' | 'GET'): Promise<number | null> => {
  let current = url;

  for (let hop = 0; hop <= MAX_VALIDATION_REDIRECTS; hop++) {
    const response = await fetch(current, {
      method,
      headers: { 'User-Agent': THIRD_PARTY_USER_AGENT },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
    });
    response.body?.cancel(); // Only the status is needed

    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return response.status;
    }

    const next = new URL(location, current).toString();
    if (!isStreamingUrl(next)) {
      return null;
    }
    current = next;
  }

  return null;
};

/**
 * Server-side URL validation (album streaming links)
 * Security: only contacts known streaming hosts (prevents SSRF via MusicBrainz URLs)
 * @returns false only when the platform answers 4xx/5xx; network errors count as valid
 */
export const validateStreamingUrlServer = async (url: string): Promise<boolean> => {
  if (!isStreamingUrl(url)) {
    return false;
  }

  try {
    let status = await fetchStreamingStatus(url, 'HEAD');
    // Some servers reject HEAD requests, so retry with GET
    if (status !== null && status >= 400) {
      status = await fetchStreamingStatus(url, 'GET');
    }
    // A redirect to a non-streaming host is not proof the link is dead
    return status === null || status < 400;
  } catch {
    return true; // Assume valid on network error (don't discard)
  }
};

// Older versions kept album -> streaming URL mappings here; the server cache replaces it
const LEGACY_STREAMING_URL_CACHE_KEY = 'streamingUrlCache';
let legacyCacheRemoved = false;

const removeLegacyStreamingUrlCache = (): void => {
  if (legacyCacheRemoved || typeof window === 'undefined') return;
  legacyCacheRemoved = true;
  try {
    localStorage.removeItem(LEGACY_STREAMING_URL_CACHE_KEY);
  } catch {
    // Storage blocked: nothing to clean up
  }
};

/**
 * Fetches the streaming links of an album (release group) from the server
 * The server combines MusicBrainz links of all releases with barcode lookups and caches the result
 * Platform filtering by the user's enabled services happens in StreamingLinksSection
 * @param signal - Optional AbortSignal to cancel the request
 */
export const fetchStreamingLinksForAlbum = async (
  releaseGroupId: string,
  country: string = 'DE',
  signal?: AbortSignal
): Promise<{ links: StreamingLinks | null; fromCache: boolean }> => {
  removeLegacyStreamingUrlCache();

  try {
    const params = new URLSearchParams({ releaseGroup: releaseGroupId, country });
    const response = await fetch(`/api/streaming-links?${params}`, { signal });
    if (!response.ok) {
      console.warn(`❌ Streaming links API error: ${response.status}`);
      return { links: null, fromCache: false };
    }

    const { links, fromCache } = (await response.json()) as { links?: StreamingLinks; fromCache?: boolean };
    const hasLinks = !!links && Object.keys(links).length > 0;
    return { links: hasLinks ? links : null, fromCache: !!fromCache };
  } catch (error) {
    // Don't log AbortError - it's expected when user switches albums
    if (error instanceof Error && error.name === 'AbortError') {
      return { links: null, fromCache: false };
    }
    console.error(`Error fetching streaming links for album ${releaseGroupId}:`, error);
    return { links: null, fromCache: false };
  }
};
