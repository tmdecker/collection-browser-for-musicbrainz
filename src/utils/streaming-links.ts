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
import { fetchReleaseUrlRels } from '@/utils/api';

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
const extractAllStreamingUrls = (release: Release): string[] => {
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
 * Tests multiple URLs with Odesli API until one is recognized
 * Returns the streaming links from the first successful URL
 * @param signal - Optional AbortSignal to cancel the operation
 */
const tryUrlsWithOdesli = async (
  urls: string[],
  userCountry: string = 'DE',
  albumTitle?: string,
  signal?: AbortSignal
): Promise<{ streamingLinks: StreamingLinks; successfulUrl: string; fromCache: boolean } | null> => {
  if (!urls || urls.length === 0) {
    return null;
  }

  console.log(`Testing ${urls.length} URLs with Odesli for album: ${albumTitle || 'Unknown'}`);

  for (let i = 0; i < urls.length; i++) {
    // Check if operation was aborted
    if (signal?.aborted) {
      console.log('⚠️ URL testing aborted');
      return null;
    }

    const url = urls[i];

    try {
      console.log(`Trying URL ${i + 1}/${urls.length}: ${url}`);

      const result = await fetchStreamingLinks(url, userCountry, signal);
      const streamingLinks = result.links;

      if (streamingLinks && Object.keys(streamingLinks).length > (streamingLinks.thumbnail ? 1 : 0)) {
        console.log(`✓ Success! Odesli recognized URL ${i + 1}/${urls.length}: ${url}`);
        logUrlTestingStats(albumTitle || 'Unknown', urls.length, i + 1, url);
        return { streamingLinks, successfulUrl: url, fromCache: result.fromCache };
      } else {
        console.log(`✗ URL ${i + 1}/${urls.length} not recognized by Odesli: ${url}`);
      }

    } catch (error) {
      console.warn(`Error testing URL ${i + 1}/${urls.length} (${url}):`, error);
      // Continue to next URL even if this one fails
    }
  }

  console.log(`All ${urls.length} URLs failed with Odesli`);
  logUrlTestingStats(albumTitle || 'Unknown', urls.length, urls.length);
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
    if (hostname.includes('youtube.com')) return 'youtube';
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
 * Prioritizes URLs based on user preferences
 * Returns URLs sorted by preference order
 */
const prioritizeUrls = (urls: string[], userPreferences: string[] = []): string[] => {
  if (!urls || urls.length === 0) {
    return [];
  }

  // If no preferences specified, return URLs as-is
  if (!userPreferences || userPreferences.length === 0) {
    return urls;
  }

  const prioritized: string[] = [];
  const remaining: string[] = [];

  // Group URLs by platform
  const urlsByPlatform: Record<string, string[]> = {};

  for (const url of urls) {
    const platform = getPlatformFromUrl(url);
    if (platform) {
      if (!urlsByPlatform[platform]) {
        urlsByPlatform[platform] = [];
      }
      urlsByPlatform[platform].push(url);
    } else {
      remaining.push(url);
    }
  }

  // Add URLs based on user preference order
  for (const preference of userPreferences) {
    const platformUrls = urlsByPlatform[preference];
    if (platformUrls) {
      prioritized.push(...platformUrls);
      delete urlsByPlatform[preference]; // Remove to avoid duplicates
    }
  }

  // Add remaining platform URLs (not in preferences)
  for (const platformUrls of Object.values(urlsByPlatform)) {
    prioritized.push(...platformUrls);
  }

  // Add any unrecognized URLs at the end
  prioritized.push(...remaining);

  return prioritized;
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
    return STREAMING_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
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
 * Filters streaming links based on user preferences
 */
export const selectPreferredPlatforms = (
  streamingLinks: StreamingLinks,
  preferences: string[]
): StreamingLinks => {
  if (!preferences || preferences.length === 0) {
    return streamingLinks;
  }

  const filtered: StreamingLinks = {};

  // Include thumbnail regardless of preferences
  if (streamingLinks.thumbnail) {
    filtered.thumbnail = streamingLinks.thumbnail;
  }

  // Filter platforms based on preferences
  for (const platform of preferences) {
    const platformKey = platform as keyof StreamingLinks;
    if (streamingLinks[platformKey] && platformKey !== 'thumbnail') {
      filtered[platformKey] = streamingLinks[platformKey];
    }
  }

  return filtered;
};

/**
 * Gets user streaming preferences from localStorage
 */
export const getStreamingPreferences = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const config = localStorage.getItem('mbConfigOptions');
    if (config) {
      const parsed = JSON.parse(config);
      return parsed.preferredStreamingPlatforms || [];
    }
  } catch (error) {
    console.error('Error reading streaming preferences:', error);
  }

  return [];
};

/**
 * Enhanced streaming URL finder with fallback strategy and multi-URL testing
 * Tests ALL available URLs with Odesli before moving to fallback releases
 * @param signal - Optional AbortSignal to cancel the operation
 */
const findStreamingUrlWithFallback = async (
  primaryRelease: Release | null,
  allReleases: Release[],
  albumTitle: string,
  userCountry: string = 'DE',
  signal?: AbortSignal
): Promise<{ streamingLinks: StreamingLinks; successfulUrl: string; fromCache: boolean } | null> => {
  const userPreferences = getStreamingPreferences();

  // First, try ALL URLs from the primary release (already fetched with URL relationships)
  if (primaryRelease) {
    // Check if aborted
    if (signal?.aborted) {
      console.log('⚠️ Streaming URL discovery aborted');
      return null;
    }

    console.log(`Extracting all URLs from primary release ${primaryRelease.id}`);
    const urls = extractAllStreamingUrls(primaryRelease);

    if (urls.length > 0) {
      console.log(`Found ${urls.length} streaming URLs in primary release ${primaryRelease.id}`);

      // Prioritize URLs based on user preferences
      const prioritizedUrls = prioritizeUrls(urls, userPreferences);

      // Test all URLs with Odesli
      const result = await tryUrlsWithOdesli(prioritizedUrls, userCountry, albumTitle, signal);
      if (result) {
        console.log(`✓ Primary release ${primaryRelease.id} provided working URL: ${result.successfulUrl}`);
        return result;
      }
    }
  }

  // Check if aborted before continuing to fallback
  if (signal?.aborted) {
    console.log('⚠️ Streaming URL discovery aborted');
    return null;
  }

  // If no working URL from primary release, try fallback strategy
  console.log(`No working URLs in primary release, trying fallback releases for album: ${albumTitle}`);

  // Debug: Log total releases and their countries
  console.log(`🔍 DEBUG: Total releases available: ${allReleases.length}`);
  const xwReleases = allReleases.filter(r => r.country === 'XW');
  console.log(`🔍 DEBUG: XW releases in allReleases: ${xwReleases.length}`);
  if (xwReleases.length > 0) {
    console.log('🔍 DEBUG: XW releases:', xwReleases.map(r => ({ id: r.id, date: r.date, country: r.country })));
  }

  // Create a list of releases to try, excluding the primary release
  const fallbackReleases = allReleases.filter(release =>
    release.id !== primaryRelease?.id
  );

  // Separate releases by priority tiers
  // Note: release.media is often undefined in the releases array, so we can't reliably detect Digital Media format
  // Instead, we rely on country code (XW) and date (newer releases are more likely Digital Media)

  // Priority 1: Worldwide (XW) releases (try ALL - most likely to have streaming links)
  // Sort by date (newest first) as Digital Media releases are typically newer
  const worldwideReleases = fallbackReleases
    .filter(release => release.country === 'XW')
    .sort((a, b) => {
      const aDate = a.date || '0000-00-00';
      const bDate = b.date || '0000-00-00';
      return bDate.localeCompare(aDate); // Newest first
    });

  // Priority 2: Other country-specific releases (limit to 5, newest first)
  // Increased limit from 3 to 5 for better coverage
  const otherReleases = fallbackReleases
    .filter(release => release.country !== 'XW')
    .sort((a, b) => {
      const aDate = a.date || '0000-00-00';
      const bDate = b.date || '0000-00-00';
      return bDate.localeCompare(aDate); // Newest first
    })
    .slice(0, 5);

  // Combine all tiers: ALL XW releases (newest first) + top 5 other releases (newest first)
  const releasesToTry = [
    ...worldwideReleases,
    ...otherReleases
  ];

  console.log(`Will try ${worldwideReleases.length} Worldwide (XW) releases (all, newest first), and ${otherReleases.length} other releases (newest first)`);

  for (const release of releasesToTry) {
    // Check if aborted before each release
    if (signal?.aborted) {
      console.log('⚠️ Streaming URL discovery aborted');
      return null;
    }

    try {
      console.log(`Fetching URL relationships for fallback release ${release.id} (${release.country || 'Unknown country'})`);

      // Fetch URL relationships for this release
      const releaseWithUrls = await fetchReleaseUrlRels(release.id, signal);
      const urls = extractAllStreamingUrls(releaseWithUrls);

      if (urls.length > 0) {
        console.log(`Found ${urls.length} streaming URLs in fallback release ${release.id}`);

        // Prioritize URLs based on user preferences
        const prioritizedUrls = prioritizeUrls(urls, userPreferences);

        // Test all URLs with Odesli
        const result = await tryUrlsWithOdesli(prioritizedUrls, userCountry, albumTitle, signal);
        if (result) {
          console.log(`✓ Fallback release ${release.id} provided working URL: ${result.successfulUrl}`);
          return result;
        }
      }

      // Add delay between release attempts to respect MusicBrainz rate limits
      if (releasesToTry.indexOf(release) < releasesToTry.length - 1) {
        console.log('Waiting 2 seconds before trying next release...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      // Don't log AbortError
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⚠️ Streaming URL discovery aborted');
        return null;
      }
      console.warn(`Failed to fetch URL relationships for release ${release.id}:`, error);
      // Continue to next release
    }
  }

  console.log(`No working streaming URLs found after checking ${releasesToTry.length} fallback releases`);
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

        // Filter by user preferences
        const preferences = getStreamingPreferences();
        const filteredLinks = selectPreferredPlatforms(cachedResult.links, preferences);

        return { links: filteredLinks, fromCache: true };
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
      console.log(`No working streaming links found for album: ${releaseGroup.title}`);
      return { links: null, fromCache: false };
    }

    const { streamingLinks, successfulUrl, fromCache } = result;

    // Cache the successful URL for future instant lookups
    setCachedStreamingUrl(releaseGroup.id, successfulUrl);

    // Filter by user preferences
    const preferences = getStreamingPreferences();
    const filteredLinks = selectPreferredPlatforms(streamingLinks, preferences);

    const platformCount = Object.keys(filteredLinks).length - (filteredLinks.thumbnail ? 1 : 0);
    console.log(`✓ Album "${releaseGroup.title}" linked via ${successfulUrl} → ${platformCount} platforms available`);

    return { links: filteredLinks, fromCache };

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