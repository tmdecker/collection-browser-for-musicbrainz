/**
 * @ai-file utility
 * @ai-description Fetches and processes streaming links via Odesli API
 * @ai-dependencies fetchReleaseUrlRels from api.ts, ReleaseGroup/Release/StreamingLinks types
 * @ai-features
 * - Searches MusicBrainz releases for streaming platform URLs
 * - Fetches streaming links from Odesli API with platform mapping
 * - Filters links based on user preferences
 * - Handles caching and error scenarios
 */

import { ReleaseGroup, Release, StreamingLinks } from '@/types/music';
import axios from 'axios';
import { fetchReleaseUrlRels } from '@/utils/api';
import { orderReleasesForStreaming } from '@/utils/release-selection';
import { THIRD_PARTY_USER_AGENT } from '@/utils/config/userAgent';

// Platform mapping from Odesli response to our StreamingLinks interface
const PLATFORM_MAPPING: Record<string, keyof StreamingLinks> = {
  'spotify': 'spotify',
  'appleMusic': 'appleMusic',
  'itunes': 'appleMusic', // iTunes and Apple Music use same field
  'youtube': 'youtube',
  'youtubeMusic': 'youtubeMusic',
  'amazon': 'amazon',
  'amazonMusic': 'amazonMusic',
  'deezer': 'deezer',
  'tidal': 'tidal',
  'soundcloud': 'soundcloud',
  'pandora': 'pandora',
  'bandcamp': 'bandcamp',
};

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

/**
 * Searches through releases to find a streaming platform URL
 * Prioritizes Digital Media + Worldwide releases
 */
export const findStreamingUrl = (releases: Release[]): string | null => {
  if (!releases || releases.length === 0) {
    return null;
  }

  // Priority 1: Digital Media + Worldwide
  const digitalWorldwide = releases.find(release => {
    const hasDigitalMedia = release.media?.some(media =>
      media.format === 'Digital Media'
    );
    const isWorldwide = release.country === 'XW';
    return hasDigitalMedia && isWorldwide;
  });

  if (digitalWorldwide) {
    const url = extractUrlFromRelease(digitalWorldwide);
    if (url) {
      console.log(`Found streaming URL from digital worldwide release: ${digitalWorldwide.id}`);
      return url;
    }
  }

  // Priority 2: Any Digital Media release
  const digitalReleases = releases.filter(release =>
    release.media?.some(media => media.format === 'Digital Media')
  );

  for (const release of digitalReleases) {
    const url = extractUrlFromRelease(release);
    if (url) {
      console.log(`Found streaming URL from digital release: ${release.id}`);
      return url;
    }
  }

  // Priority 3: Any release with streaming URL
  for (const release of releases) {
    const url = extractUrlFromRelease(release);
    if (url) {
      console.log(`Found streaming URL from release: ${release.id}`);
      return url;
    }
  }

  return null;
};

/**
 * Extracts streaming URLs from a release's relationships/URLs
 * Looks for streaming platform URLs in the release's URL relationships
 */
const extractUrlFromRelease = (release: Release): string | null => {
  if (!release.relations) {
    return null;
  }

  // Look for streaming platform URLs in relationships
  for (const relation of release.relations) {
    if ((relation.type === 'streaming' || relation.type === 'free streaming') && relation.url?.resource) {
      const url = relation.url.resource;

      // Check if this is a supported streaming platform URL
      if (isStreamingUrl(url)) {
        console.log(`Found streaming URL in release ${release.id}: ${url}`);
        return url;
      }
    }

    // Also check for purchase for download relationships (might contain streaming links)
    if (relation.type === 'purchase for download' && relation.url?.resource) {
      const url = relation.url.resource;

      if (isStreamingUrl(url)) {
        console.log(`Found streaming URL via purchase relationship in release ${release.id}: ${url}`);
        return url;
      }
    }
  }

  return null;
};

/**
 * Extracts ALL streaming URLs from a release's relationships/URLs
 * Returns all found URLs for testing with Odesli
 */
export const extractAllStreamingUrls = (release: Release): string[] => {
  const urls: string[] = [];

  if (!release.relations) {
    return urls;
  }

  // Look for streaming platform URLs in relationships
  for (const relation of release.relations) {
    if ((relation.type === 'streaming' || relation.type === 'free streaming') && relation.url?.resource) {
      const url = relation.url.resource;

      // Check if this is a supported streaming platform URL
      if (isStreamingUrl(url)) {
        urls.push(url);
        console.log(`Found streaming URL (${relation.type}) in release ${release.id}: ${url}`);
      }
    }

    // Also check for purchase for download relationships (might contain streaming links)
    if (relation.type === 'purchase for download' && relation.url?.resource) {
      const url = relation.url.resource;

      if (isStreamingUrl(url)) {
        urls.push(url);
        console.log(`Found streaming URL (purchase) in release ${release.id}: ${url}`);
      }
    }
  }

  return urls;
};

/**
 * All known streaming platform keys (excluding thumbnail)
 */
const ALL_PLATFORM_KEYS: (keyof StreamingLinks)[] = [
  'spotify', 'appleMusic', 'youtube', 'youtubeMusic',
  'amazon', 'amazonMusic', 'deezer', 'tidal',
  'soundcloud', 'pandora', 'bandcamp',
];

/**
 * Tests URLs with Odesli API until one is recognized.
 * Tries the next URL (up to MAX_ODESLI_CALLS calls) only when Odesli returns no links for the previous one.
 * @param signal - Optional AbortSignal to cancel the operation
 */
const MAX_ODESLI_CALLS = 2;

const tryUrlsWithOdesli = async (
  urls: string[],
  userCountry: string = 'DE',
  albumTitle?: string,
  signal?: AbortSignal
): Promise<{ streamingLinks: StreamingLinks; successfulUrl: string; fromCache: boolean } | null> => {
  if (!urls || urls.length === 0) {
    return null;
  }

  console.log(`Testing up to ${Math.min(urls.length, MAX_ODESLI_CALLS)} of ${urls.length} URLs with Odesli for album: ${albumTitle || 'Unknown'}`);

  let merged: StreamingLinks = {};
  let firstSuccessfulUrl: string | null = null;
  let anyFromCache = false;
  let odesliCalls = 0;

  for (let i = 0; i < urls.length && odesliCalls < MAX_ODESLI_CALLS; i++) {
    if (signal?.aborted) {
      console.log('⚠️ URL testing aborted');
      return null;
    }

    const url = urls[i];

    try {
      console.log(`Trying URL ${i + 1}/${urls.length} (Odesli call ${odesliCalls + 1}/${MAX_ODESLI_CALLS}): ${url}`);

      const result = await fetchStreamingLinks(url, userCountry, signal);
      odesliCalls++;
      const streamingLinks = result.links;

      if (streamingLinks && Object.keys(streamingLinks).length > (streamingLinks.thumbnail ? 1 : 0)) {
        console.log(`✓ Odesli recognized URL ${i + 1}/${urls.length}: ${url}`);

        if (!firstSuccessfulUrl) {
          firstSuccessfulUrl = url;
        }
        if (result.fromCache) {
          anyFromCache = true;
        }

        // First recognized URL wins; further Odesli calls only happen when a URL is not recognized
        merged = streamingLinks;
        break;
      } else {
        console.log(`✗ URL ${i + 1}/${urls.length} not recognized by Odesli: ${url}`);
      }

    } catch (error) {
      console.warn(`Error testing URL ${i + 1}/${urls.length} (${url}):`, error);
    }
  }

  if (firstSuccessfulUrl) {
    const platformCount = ALL_PLATFORM_KEYS.filter(k => merged[k]).length;
    logUrlTestingStats(albumTitle || 'Unknown', urls.length, odesliCalls, firstSuccessfulUrl);
    console.log(`Odesli provided ${platformCount} platforms after ${odesliCalls} call(s)`);
    return { streamingLinks: merged, successfulUrl: firstSuccessfulUrl, fromCache: anyFromCache };
  }

  console.log(`All ${odesliCalls} Odesli calls failed for album: ${albumTitle || 'Unknown'}`);
  logUrlTestingStats(albumTitle || 'Unknown', urls.length, odesliCalls);
  return null;
};

/**
 * Gets the platform name from a streaming URL
 */
const getPlatformFromUrl = (url: string): string | null => {
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
 * Logs detailed statistics about URL testing for debugging
 */
const logUrlTestingStats = (
  albumTitle: string,
  totalUrls: number,
  testedUrls: number,
  successfulUrl?: string,
  releaseId?: string
): void => {
  const stats = {
    album: albumTitle,
    release: releaseId || 'primary',
    totalUrls,
    testedUrls,
    success: !!successfulUrl,
    successfulUrl: successfulUrl || 'none'
  };

  console.log(`🎵 Streaming URL Stats for "${albumTitle}":`, stats);
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

/**
 * Validates a streaming URL by checking if it's alive (not 404/gone)
 * Uses server-side HEAD request proxy to avoid CORS issues
 */
const validateStreamingUrl = async (url: string, signal?: AbortSignal): Promise<boolean> => {
  try {
    const response = await fetch(`/api/validate-url?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      signal,
    });
    if (!response.ok) return true; // Assume valid on proxy error
    const data = await response.json();
    return data.valid;
  } catch {
    return true; // On network error, assume valid (don't discard)
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
 * Server-side URL validation for use in prefetch service and the validate-url route
 * Security: only contacts known streaming hosts (prevents SSRF via MusicBrainz URLs or the API route)
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

/**
 * Builds StreamingLinks directly from MusicBrainz URLs by mapping each to its platform
 * Validates each URL for liveness before including it
 */
const buildDirectLinksFromUrls = async (
  urls: string[],
  signal?: AbortSignal
): Promise<StreamingLinks> => {
  const links: StreamingLinks = {};

  // Validate URLs in parallel (batch of all URLs at once)
  const validationResults = await Promise.all(
    urls.map(async (url) => {
      const platform = getPlatformFromUrl(url);
      if (!platform || platform === 'thumbnail') return null;
      // Skip if we already have a link for this platform
      if (links[platform as keyof StreamingLinks]) return null;

      const valid = await validateStreamingUrl(url, signal);
      return valid ? { platform, url } : null;
    })
  );

  for (const result of validationResults) {
    if (result && !links[result.platform as keyof StreamingLinks]) {
      (links as Record<string, string>)[result.platform] = result.url;
    }
  }

  return links;
};

/**
 * Server-side version of buildDirectLinksFromUrls for use in prefetch service
 */
export const buildDirectLinksFromUrlsServer = async (
  urls: string[]
): Promise<StreamingLinks> => {
  const links: StreamingLinks = {};

  const validationResults = await Promise.all(
    urls.map(async (url) => {
      const platform = getPlatformFromUrl(url);
      if (!platform || platform === 'thumbnail') return null;

      const valid = await validateStreamingUrlServer(url);
      return valid ? { platform, url } : null;
    })
  );

  for (const result of validationResults) {
    if (result && !links[result.platform as keyof StreamingLinks]) {
      (links as Record<string, string>)[result.platform] = result.url;
    }
  }

  return links;
};

/**
 * Merges two StreamingLinks objects. Base takes priority, overlay fills gaps.
 * Thumbnail prefers overlay (Odesli provides thumbnails, direct MB URLs don't)
 */
const mergeStreamingLinks = (base: StreamingLinks, overlay: StreamingLinks): StreamingLinks => {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (key === 'thumbnail') continue; // Handle thumbnail separately
    if (value && !merged[key as keyof StreamingLinks]) {
      (merged as Record<string, string>)[key] = value;
    }
  }
  // Prefer Odesli thumbnail (direct MB URLs don't provide thumbnails)
  if (overlay.thumbnail) {
    merged.thumbnail = overlay.thumbnail;
  }
  return merged;
};

/**
 * Fetches streaming links from Odesli API with IndexedDB caching (1-week TTL)
 * Returns both the links and whether they came from cache
 * @param signal - Optional AbortSignal to cancel the fetch operation
 */
export const fetchStreamingLinks = async (
  streamingUrl: string,
  userCountry: string = 'DE',
  signal?: AbortSignal
): Promise<{ links: StreamingLinks | null; fromCache: boolean }> => {
  if (!isStreamingUrl(streamingUrl)) {
    console.warn(`URL not from supported streaming platform: ${streamingUrl}`);
    return { links: null, fromCache: false };
  }

  // Check if already aborted
  if (signal?.aborted) {
    console.log('⚠️ Fetch aborted before starting');
    return { links: null, fromCache: false };
  }

  // Try to get from cache (client-side only, non-blocking)
  if (typeof window !== 'undefined') {
    try {
      const db = await import('./db');
      const cachedLinks = await db.getStreamingLinks(streamingUrl, userCountry);

      if (cachedLinks) {
        console.log(`✅ Cache hit for streaming links: ${streamingUrl}`);
        return { links: cachedLinks, fromCache: true };
      }

      // Check if this URL is a known failure (cached with :failed suffix)
      const failureMarker = await db.getStreamingLinks(`${streamingUrl}:failed`, userCountry);
      if (failureMarker !== null && typeof failureMarker === 'object') {
        // Check if it's an empty object (failure marker)
        const isEmpty = Object.keys(failureMarker).length === 0;
        if (isEmpty) {
          console.log(`⚠️ Skipping known-bad URL from cache: ${streamingUrl}`);
          return { links: null, fromCache: true };
        }
      }
    } catch (cacheError) {
      // Cache failure shouldn't break the functionality
      console.warn('⚠️ Cache read failed, fetching from API:', cacheError);
    }
  }

  // Check again before API call
  if (signal?.aborted) {
    console.log('⚠️ Fetch aborted after cache check');
    return { links: null, fromCache: false };
  }

  // Fetch from API (always proceed here if no cache hit)
  try {
    console.log(`🌐 Fetching streaming links from API: ${streamingUrl}`);

    const apiUrl = `/api/streaming-links?url=${encodeURIComponent(streamingUrl)}&userCountry=${userCountry}`;
    const response = await fetch(apiUrl, { signal });

    if (!response.ok) {
      console.error(`❌ Streaming links API error: ${response.status}`);

      // Cache the failure so we don't retry this bad URL
      if (typeof window !== 'undefined' && (response.status === 400 || response.status === 404)) {
        try {
          const db = await import('./db');
          // Store empty object as failure marker with shorter TTL (1 day instead of 1 week)
          await db.storeStreamingLinks(`${streamingUrl}:failed`, {}, userCountry);
          console.log(`💾 Cached failure for: ${streamingUrl}`);
        } catch (cacheError) {
          console.warn('⚠️ Failed to cache error:', cacheError);
        }
      }

      return { links: null, fromCache: false };
    }

    const data = await response.json();

    // Handle API errors gracefully
    if (data.error) {
      console.warn(`❌ Odesli API error: ${data.error}`);

      // Cache the failure so we don't retry this bad URL
      if (typeof window !== 'undefined') {
        try {
          const db = await import('./db');
          await db.storeStreamingLinks(`${streamingUrl}:failed`, {}, userCountry);
          console.log(`💾 Cached failure for: ${streamingUrl}`);
        } catch (cacheError) {
          console.warn('⚠️ Failed to cache error:', cacheError);
        }
      }

      return { links: null, fromCache: false };
    }

    const parsedLinks = parseOdesliResponse(data);

    // Try to cache result (client-side only, non-blocking)
    if (parsedLinks && Object.keys(parsedLinks).length > 0 && typeof window !== 'undefined') {
      try {
        const db = await import('./db');
        await db.storeStreamingLinks(streamingUrl, parsedLinks, userCountry);
        console.log(`💾 Cached streaming links for: ${streamingUrl}`);
      } catch (cacheError) {
        // Cache failure shouldn't break the functionality
        console.warn('⚠️ Cache store failed:', cacheError);
      }
    }

    return { links: parsedLinks, fromCache: false };

  } catch (error) {
    // Don't log AbortError - it's expected when user switches albums
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('⚠️ Streaming links fetch aborted');
      return { links: null, fromCache: false };
    }
    console.error('❌ Error fetching streaming links:', error);
    return { links: null, fromCache: false };
  }
};

/**
 * Parses Odesli API response and maps to our StreamingLinks format
 * Prioritizes Apple Music over iTunes when both are present
 */
const parseOdesliResponse = (odesliData: any): StreamingLinks => {
  const links: StreamingLinks = {};

  if (!odesliData.linksByPlatform) {
    return links;
  }

  // Map platform links (skip iTunes - only use appleMusic)
  for (const [platform, linkData] of Object.entries(odesliData.linksByPlatform)) {
    if (platform === 'itunes') continue; // Skip iTunes, only use Apple Music

    const mappedPlatform = PLATFORM_MAPPING[platform];

    if (mappedPlatform && typeof linkData === 'object' && linkData !== null) {
      const linkInfo = linkData as any;
      if (linkInfo.url) {
        links[mappedPlatform] = linkInfo.url;
      }
    }
  }

  // Extract thumbnail from entities
  if (odesliData.entitiesByUniqueId) {
    const entities = Object.values(odesliData.entitiesByUniqueId);
    const entityWithThumbnail = entities.find((entity: any) => entity?.thumbnailUrl);

    if (entityWithThumbnail) {
      links.thumbnail = (entityWithThumbnail as any).thumbnailUrl;
    }
  }

  return links;
};

/**
 * Enhanced streaming URL finder with direct links + Odesli merge strategy.
 * 1. Extracts direct MusicBrainz URLs and validates them
 * 2. Uses Odesli to discover additional platforms
 * 3. Merges both sources: direct MB URLs as baseline, Odesli fills gaps
 * 4. Falls back to direct-only links if Odesli fails entirely
 * @param signal - Optional AbortSignal to cancel the operation
 */
// Releases without inline url-rels (cached before browse included them) cost one MusicBrainz lookup each
const MAX_FALLBACK_LOOKUPS = 5;

const findStreamingUrlWithFallback = async (
  primaryRelease: Release | null,
  allReleases: Release[],
  albumTitle: string,
  userCountry: string = 'DE',
  signal?: AbortSignal
): Promise<{ streamingLinks: StreamingLinks; successfulUrl: string; fromCache: boolean } | null> => {
  // First, try the primary release (already fetched with URL relationships)
  if (primaryRelease) {
    if (signal?.aborted) {
      return null;
    }

    console.log(`Extracting all URLs from primary release ${primaryRelease.id}`);
    const urls = extractAllStreamingUrls(primaryRelease);

    if (urls.length > 0) {
      console.log(`Found ${urls.length} streaming URLs in primary release ${primaryRelease.id}`);

      // Build direct links from MusicBrainz URLs (validated for liveness)
      const directLinks = await buildDirectLinksFromUrls(urls, signal);
      const directCount = ALL_PLATFORM_KEYS.filter(k => directLinks[k]).length;
      console.log(`Direct MB links (validated): ${directCount} platforms from primary release`);

      // Try Odesli for cross-platform discovery
      const odesliResult = await tryUrlsWithOdesli(urls, userCountry, albumTitle, signal);

      if (odesliResult) {
        // Merge: direct MB links as base, Odesli fills gaps
        const merged = mergeStreamingLinks(directLinks, odesliResult.streamingLinks);
        const mergedCount = ALL_PLATFORM_KEYS.filter(k => merged[k]).length;
        console.log(`✓ Merged result for primary release: ${mergedCount} platforms (${directCount} direct + Odesli fill)`);
        return { streamingLinks: merged, successfulUrl: odesliResult.successfulUrl, fromCache: odesliResult.fromCache };
      }

      // Odesli failed — return direct links if we have any
      if (directCount > 0) {
        console.log(`Odesli failed, using ${directCount} direct MB links for: ${albumTitle}`);
        return { streamingLinks: directLinks, successfulUrl: urls[0], fromCache: false };
      }
    }
  }

  if (signal?.aborted) {
    return null;
  }

  // Fallback: try the other releases of the group
  console.log(`No working URLs in primary release, trying fallback releases for album: ${albumTitle}`);

  // Releases browsed with url-rels already carry their links; older cached releases need one lookup each
  const releasesToTry = orderReleasesForStreaming(
    allReleases.filter(release => release.id !== primaryRelease?.id)
  );
  console.log(`Will try ${releasesToTry.length} releases (Digital Media, then XW, then the rest)`);

  // Accumulate direct links across all fallback releases
  let accumulatedDirectLinks: StreamingLinks = {};
  let firstDirectUrl: string | null = null;
  let lookups = 0;

  for (const release of releasesToTry) {
    if (signal?.aborted) {
      return null;
    }

    try {
      let urls: string[];
      if (release.relations) {
        urls = extractAllStreamingUrls(release);
      } else {
        if (lookups >= MAX_FALLBACK_LOOKUPS) continue;
        // Rate limit delay between MusicBrainz lookups
        if (lookups > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        lookups++;
        console.log(`Fetching URL relationships for fallback release ${release.id} (${release.country || 'Unknown'})`);
        const releaseWithUrls = await fetchReleaseUrlRels(release.id, signal);
        urls = extractAllStreamingUrls(releaseWithUrls);
      }

      if (urls.length > 0) {
        console.log(`Found ${urls.length} streaming URLs in fallback release ${release.id}`);

        // Build and validate direct links
        const directLinks = await buildDirectLinksFromUrls(urls, signal);
        accumulatedDirectLinks = mergeStreamingLinks(accumulatedDirectLinks, directLinks);
        if (!firstDirectUrl) firstDirectUrl = urls[0];

        // Try Odesli for cross-platform discovery
        const odesliResult = await tryUrlsWithOdesli(urls, userCountry, albumTitle, signal);

        if (odesliResult) {
          const merged = mergeStreamingLinks(accumulatedDirectLinks, odesliResult.streamingLinks);
          const mergedCount = ALL_PLATFORM_KEYS.filter(k => merged[k]).length;
          console.log(`✓ Fallback release ${release.id} provided ${mergedCount} platforms (merged)`);
          return { streamingLinks: merged, successfulUrl: odesliResult.successfulUrl, fromCache: odesliResult.fromCache };
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
        return null;
      }
      console.warn(`Failed to fetch URL relationships for release ${release.id}:`, error);
    }
  }

  // Odesli failed for all releases — return accumulated direct links if we have any
  const directCount = ALL_PLATFORM_KEYS.filter(k => accumulatedDirectLinks[k]).length;
  if (directCount > 0 && firstDirectUrl) {
    console.log(`Odesli failed for all releases, using ${directCount} accumulated direct MB links for: ${albumTitle}`);
    return { streamingLinks: accumulatedDirectLinks, successfulUrl: firstDirectUrl, fromCache: false };
  }

  console.log(`No working streaming URLs found in ${releasesToTry.length} fallback releases (${lookups} lookups)`);
  return null;
};

/**
 * Cache key for storing album -> streaming URL mappings in localStorage
 */
const STREAMING_URL_CACHE_KEY = 'streamingUrlCache';

/**
 * Get cached streaming URL for an album
 */
const getCachedStreamingUrl = (albumId: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const cache = localStorage.getItem(STREAMING_URL_CACHE_KEY);
    if (!cache) return null;

    const parsed = JSON.parse(cache);
    return parsed[albumId] || null;
  } catch (error) {
    console.warn('Failed to read streaming URL cache:', error);
    return null;
  }
};

/**
 * Store cached streaming URL for an album
 */
const setCachedStreamingUrl = (albumId: string, url: string): void => {
  if (typeof window === 'undefined') return;

  try {
    const cache = localStorage.getItem(STREAMING_URL_CACHE_KEY);
    const parsed = cache ? JSON.parse(cache) : {};
    parsed[albumId] = url;
    localStorage.setItem(STREAMING_URL_CACHE_KEY, JSON.stringify(parsed));
    console.log(`💾 Cached streaming URL mapping: ${albumId} → ${url}`);
  } catch (error) {
    console.warn('Failed to store streaming URL cache:', error);
  }
};

/**
 * Main function to fetch streaming links for an album
 * Uses enhanced multi-URL testing strategy with fallback releases
 * Returns both the links and whether they came from cache
 * @param signal - Optional AbortSignal to cancel the entire operation
 */
const MAX_BARCODES_PER_ALBUM = 2;

/**
 * Barcodes to try for an album: the displayed release first, then other releases (distinct, valid only)
 */
const candidateBarcodes = (primaryRelease: Release | undefined, releases: Release[]): string[] => {
  const barcodes: string[] = [];
  for (const release of [primaryRelease, ...releases]) {
    const barcode = release?.barcode?.trim();
    if (barcode && /^(\d{8}|\d{12,14})$/.test(barcode) && !barcodes.includes(barcode)) {
      barcodes.push(barcode);
    }
    if (barcodes.length >= MAX_BARCODES_PER_ALBUM) break;
  }
  return barcodes;
};

/**
 * Fill platforms the other sources missed with links found by barcode (Deezer, Apple Music,
 * Spotify, Tidal). Links that came from MusicBrainz or Odesli always win.
 */
const addBarcodeLinks = async (
  links: StreamingLinks | null,
  primaryRelease: Release | undefined,
  releases: Release[],
  country: string,
  signal?: AbortSignal
): Promise<StreamingLinks | null> => {
  let merged = links;

  for (const barcode of candidateBarcodes(primaryRelease, releases)) {
    if (signal?.aborted) break;
    try {
      const response = await fetch(`/api/barcode-links?barcode=${barcode}&country=${country}`, { signal });
      if (!response.ok) continue;
      const { links: barcodeLinks } = (await response.json()) as { links?: StreamingLinks };
      if (barcodeLinks && Object.keys(barcodeLinks).length > 0) {
        merged = mergeStreamingLinks(merged ?? {}, barcodeLinks);
        console.log(`🏷️ Barcode ${barcode} added: ${Object.keys(barcodeLinks).join(', ')}`);
        break;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      console.warn(`⚠️ Barcode lookup failed for ${barcode}:`, error);
    }
  }

  return merged && Object.keys(merged).length > 0 ? merged : null;
};

export const fetchStreamingLinksForAlbum = async (
  releaseGroup: ReleaseGroup,
  primaryRelease?: Release,
  userCountry?: string,
  signal?: AbortSignal
): Promise<{ links: StreamingLinks | null; fromCache: boolean }> => {
  try {
    const country = userCountry || 'DE';

    // Check if already aborted
    if (signal?.aborted) {
      console.log('⚠️ Streaming links fetch aborted before starting');
      return { links: null, fromCache: false };
    }

    // FAST PATH: Check if we have a cached URL for this album
    const cachedUrl = getCachedStreamingUrl(releaseGroup.id);
    if (cachedUrl) {
      console.log(`⚡ Found cached streaming URL for album ${releaseGroup.id}: ${cachedUrl}`);

      // Try to fetch streaming links for this cached URL
      const cachedResult = await fetchStreamingLinks(cachedUrl, country, signal);

      if (cachedResult.links && Object.keys(cachedResult.links).length > 0) {
        console.log(`✅ Instant cache hit! Streaming links loaded instantly for: ${releaseGroup.title}`);

        // Platform filtering by the user's enabled services happens in StreamingLinksSection
        const links = await addBarcodeLinks(cachedResult.links, primaryRelease, releaseGroup.releases || [], country, signal);
        return { links, fromCache: true };
      } else {
        console.log(`⚠️ Cached URL no longer valid, falling back to full discovery`);
      }
    }

    // Check again before slow path
    if (signal?.aborted) {
      console.log('⚠️ Streaming links fetch aborted');
      return { links: null, fromCache: false };
    }

    // SLOW PATH: Full discovery process
    console.log(`🔍 No cached URL found, performing full streaming URL discovery for: ${releaseGroup.title}`);
    const result = await findStreamingUrlWithFallback(
      primaryRelease || null,
      releaseGroup.releases || [],
      releaseGroup.title,
      country,
      signal
    );

    if (!result) {
      // No streaming URLs on MusicBrainz: the barcode may still find the album on the platforms
      const barcodeOnly = await addBarcodeLinks(null, primaryRelease, releaseGroup.releases || [], country, signal);
      if (!barcodeOnly) {
        console.log(`No working streaming links found for album: ${releaseGroup.title}`);
      }
      return { links: barcodeOnly, fromCache: false };
    }

    const { streamingLinks, successfulUrl, fromCache } = result;

    // Cache the successful URL for future instant lookups
    setCachedStreamingUrl(releaseGroup.id, successfulUrl);

    const links = (await addBarcodeLinks(streamingLinks, primaryRelease, releaseGroup.releases || [], country, signal)) ?? streamingLinks;
    const platformCount = Object.keys(links).length - (links.thumbnail ? 1 : 0);
    console.log(`✓ Album "${releaseGroup.title}" linked via ${successfulUrl} → ${platformCount} platforms available`);

    return { links, fromCache };

  } catch (error) {
    // Don't log AbortError
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('⚠️ Streaming links fetch aborted');
      return { links: null, fromCache: false };
    }
    console.error(`Error fetching streaming links for album ${releaseGroup.id}:`, error);
    return { links: null, fromCache: false };
  }
};