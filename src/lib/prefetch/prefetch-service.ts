/**
 * @ai-file prefetch
 * @ai-description Prefetch service for release groups and streaming links
 * @ai-dependencies cache-manager, release-group-cache, release-store, streaming-links-cache, prefetch-queue, rate-limiter, odesli-rate-limiter
 * @ai-features
 * - Background prefetching of release groups after collection loads
 * - Streaming links prefetch via Odesli API
 * - Filters already-cached RGs before queueing
 * - Retry logic with exponential backoff for network errors
 * - Progress logging every 60 seconds
 */

import { cacheManager } from '../cache/cache-manager';
import { releaseGroupCache } from '../cache/release-group-cache';
import { releaseStore } from '../cache/release-store';
import { streamingLinksCache } from '../cache/streaming-links-cache';
import { prefetchQueue, type QueueStats } from './prefetch-queue';
import { getUserAgent, THIRD_PARTY_USER_AGENT } from '@/utils/config/userAgent';
import { getBarcodeLinksCached, isLookupBarcode } from '../barcode-links';
import { waitForRateLimit, backOffMusicBrainz } from '../rate-limiter';
import { waitForOdesliRateLimit } from '../odesli-rate-limiter';
import { findStreamingUrl, extractAllStreamingUrls, isStreamingUrl, buildDirectLinksFromUrlsServer, validateStreamingUrlServer } from '@/utils/streaming-links';
import { Release } from '@/types/music';
import { extractTracksFromMedia, findBestStreamingRelease, selectPreferredRelease } from '@/utils/release-selection';

const MB_BASE_URL = 'https://musicbrainz.org/ws/2';

// Progress logging state
let lastLogTime = 0;
const LOG_INTERVAL_MS = 60000; // 60 seconds

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 4000;

/**
 * Check if error is retryable (network errors, not API errors)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'fetch failed') {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('econnreset') ||
           message.includes('econnrefused') ||
           message.includes('timeout');
  }
  return false;
}

/**
 * Fetch with retry logic for transient network errors
 * @ai-feature Exponential backoff with 3 retries for network failures
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryCount = 0
): Promise<Response> {
  try {
    await waitForRateLimit('low'); // Background work: user requests go first
    const response = await fetch(url, options);
    if (response.status === 503) {
      backOffMusicBrainz(response);
      // Retry after the back-off instead of dropping the item (waitForRateLimit honors the pause)
      if (retryCount < MAX_RETRIES) {
        return fetchWithRetry(url, options, retryCount + 1);
      }
    }
    return response;
  } catch (error) {
    if (isRetryableError(error) && retryCount < MAX_RETRIES) {
      const delay = Math.min(
        INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount),
        MAX_RETRY_DELAY_MS
      );
      console.warn(`⚠️  Network error, retrying in ${delay}ms (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Prefetch status interface
 */
export interface PrefetchStatus extends QueueStats {
  isRunning: boolean;
}




/**
 * Fetch and cache a single release group
 * This is the core fetch function used by the prefetch queue
 */
async function fetchAndCacheReleaseGroup(mbid: string, country: string): Promise<void> {
  try {
    // Step 1: Fetch release group basic info
    const rgResponse = await fetchWithRetry(
      `${MB_BASE_URL}/release-group/${mbid}?fmt=json&inc=artist-credits+genres+tags+ratings`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': getUserAgent(),
        },
      }
    );

    if (!rgResponse.ok) {
      throw new Error(`MusicBrainz API error: ${rgResponse.statusText}`);
    }

    const releaseGroup = await rgResponse.json();

    // Step 2: Fetch up to 100 releases using browse endpoint
    const releasesResponse = await fetchWithRetry(
      `${MB_BASE_URL}/release?fmt=json&release-group=${mbid}&inc=media&limit=100`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': getUserAgent(),
        },
      }
    );

    if (!releasesResponse.ok) {
      throw new Error(`Failed to fetch releases: ${releasesResponse.statusText}`);
    }

    const releasesData = await releasesResponse.json();
    const releases = releasesData.releases || [];

    // Step 3: Select the preferred release
    const preferredRelease = selectPreferredRelease(releases);

    if (!preferredRelease) {
      // Store RG metadata without releases
      const now = Date.now();
      releaseGroupCache.set(mbid, {
        ...releaseGroup,
        releaseMbids: [],
        cover: `/api/coverart/release-group/${mbid}/front`,
        _cachedAt: now,
        _expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      });
      return;
    }

    // Step 4: Fetch detailed release information with tracks and labels
    const detailedReleaseResponse = await fetchWithRetry(
      `${MB_BASE_URL}/release/${preferredRelease.id}?fmt=json&inc=recordings+labels+artist-credits+url-rels`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': getUserAgent(),
        },
      }
    );

    const detailedRelease: Release = detailedReleaseResponse.ok
      ? await detailedReleaseResponse.json()
      : preferredRelease;

    // Step 5: Fetch streaming links (direct MB URLs + Odesli cross-platform)
    let streamingLinks = undefined;
    try {
      // Find best release for streaming (Digital Media + XW preferred)
      const streamingRelease = findBestStreamingRelease(releases);
      let releaseWithUrls = detailedRelease;

      // If streaming release is different, fetch its URL relationships
      if (streamingRelease && streamingRelease.id !== detailedRelease.id) {
        const urlRelResponse = await fetchWithRetry(
          `${MB_BASE_URL}/release/${streamingRelease.id}?fmt=json&inc=url-rels`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': getUserAgent(),
            },
          }
        );
        if (urlRelResponse.ok) {
          releaseWithUrls = await urlRelResponse.json();
        }
      }

      // Extract ALL streaming URLs from the release
      const allStreamingUrls = extractAllStreamingUrls(releaseWithUrls);

      // Build validated direct links from MusicBrainz URLs
      const directLinks = allStreamingUrls.length > 0
        ? await buildDirectLinksFromUrlsServer(allStreamingUrls)
        : {};

      // Try Odesli for cross-platform discovery using the first valid URL
      const streamingUrl = findStreamingUrl([releaseWithUrls]);
      let odesliLinks: Record<string, any> = {};

      if (streamingUrl) {
        // Check if already cached
        const cached = streamingLinksCache.getByUrl(streamingUrl, country);
        if (cached) {
          console.log(`✅ Streaming links cached for ${mbid}: ${streamingUrl}`);
          odesliLinks = cached.streamingLinks;
        } else if (process.env.ODESLI_API_KEY) {
          // Odesli requires an API key (keyless access was shut down); without one, only MusicBrainz links are used
          // Fetch from Odesli API with rate limiting
          await waitForOdesliRateLimit();
          const odesliUrl = new URL('https://api.song.link/v1-alpha.1/links');
          odesliUrl.searchParams.set('url', streamingUrl);
          odesliUrl.searchParams.set('userCountry', country);
          odesliUrl.searchParams.set('songIfSingle', 'true');
          odesliUrl.searchParams.set('key', process.env.ODESLI_API_KEY); // Server-only env var

          const odesliResponse = await fetch(odesliUrl.toString(), {
            headers: {
              'Accept': 'application/json',
              'User-Agent': THIRD_PARTY_USER_AGENT,
            },
            signal: AbortSignal.timeout(30000),
          });

          if (odesliResponse.ok) {
            const odesliData = await odesliResponse.json();
            odesliLinks = odesliData.linksByPlatform || {};
          }
        }
      }

      // Merge: convert direct links to Odesli-compatible format, then merge
      // Odesli format: { platformName: { url: "https://..." } }
      // Direct links fill gaps for platforms Odesli missed
      const mergedLinks: Record<string, any> = { ...odesliLinks };
      for (const [platform, url] of Object.entries(directLinks)) {
        if (platform === 'thumbnail') continue;
        // Map our platform keys to Odesli platform keys (they're mostly the same)
        if (url && !mergedLinks[platform]) {
          mergedLinks[platform] = { url };
        }
      }

      if (Object.keys(mergedLinks).length > 0) {
        streamingLinks = mergedLinks;
        const cacheUrl = streamingUrl || allStreamingUrls[0];
        if (cacheUrl) {
          const now = Date.now();
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          streamingLinksCache.setByUrl(cacheUrl, country, {
            streamingLinks: mergedLinks,
            sourceUrl: cacheUrl,
            userCountry: country,
            _cachedAt: now,
            _expiresAt: now + sevenDays,
          });
          console.log(`💾 Prefetched streaming links for ${mbid}: ${cacheUrl} (merged: ${Object.keys(mergedLinks).length} platforms)`);
        }
      }
    } catch (error) {
      // Non-critical: log and continue if streaming links fail
      console.warn(`⚠️  Failed to fetch streaming links for ${mbid}:`, error);
    }

    // Step 5b: Warm the barcode cache (Deezer, Apple Music, Spotify, Tidal), so the details panel
    // gets those links instantly; the client merges them with the links above
    try {
      const barcode = [detailedRelease, ...releases]
        .map(release => release.barcode?.trim())
        .find(isLookupBarcode);
      if (barcode) {
        await getBarcodeLinksCached(barcode, country);
      }
    } catch (error) {
      console.warn(`⚠️  Barcode lookup failed for ${mbid}:`, error);
    }

    // Step 6: Store in caches
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    // Store each release in the release store
    for (const release of releases) {
      releaseStore.set(release.id, {
        ...release,
        releaseGroupId: mbid,
        _cachedAt: now,
        _expiresAt: expiresAt,
      });
    }

    // Store detailed release if fetched
    releaseStore.set(detailedRelease.id, {
      ...detailedRelease,
      releaseGroupId: mbid,
      _cachedAt: now,
      _expiresAt: expiresAt,
    });

    // Store release group with MBID references and streaming links
    releaseGroupCache.set(mbid, {
      ...releaseGroup,
      releaseMbids: releases.map((r: Release) => r.id),
      bestReleaseMbid: preferredRelease.id,
      cover: `/api/coverart/release-group/${mbid}/front`,
      streamingLinks, // Add streaming links if fetched
      _cachedAt: now,
      _expiresAt: expiresAt,
    });

  } catch (error) {
    console.error(`❌ Failed to prefetch ${mbid}:`, error);
    throw error; // Let queue handle retry logic
  }
}

/**
 * Log prefetch progress periodically
 */
function logProgress(stats: QueueStats): void {
  const now = Date.now();
  if (now - lastLogTime < LOG_INTERVAL_MS) {
    return; // Too soon, skip
  }

  lastLogTime = now;
  const total = stats.completed + stats.processing + stats.highPriority + stats.lowPriority;
  const percentage = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  console.log(`🔄 Prefetch progress: ${stats.completed}/${total} (${percentage}%) - Queue: ${stats.lowPriority} pending, Current: ${stats.currentItem || 'none'}`);
}

/**
 * Start prefetch for a collection of release groups
 * Filters out already-cached RGs and adds uncached ones to the queue
 */
// Store country of the latest prefetch request (the queue holds MBIDs only)
let prefetchCountry = 'DE';

export async function startPrefetchForCollection(
  rgMbids: string[],
  country: string = 'DE'
): Promise<{ queued: number; alreadyCached: number }> {
  prefetchCountry = country;

  // Initialize cache manager if needed
  if (!cacheManager.isInitialized()) {
    await cacheManager.initialize();
  }

  // Filter out already-cached RGs
  const uncached: string[] = [];
  let alreadyCached = 0;

  for (const mbid of rgMbids) {
    if (releaseGroupCache.isFullyCached(mbid)) {
      alreadyCached++;
    } else {
      uncached.push(mbid);
    }
  }

  // Add uncached RGs to queue with low priority
  let queued = 0;
  for (const mbid of uncached) {
    const added = prefetchQueue.add(mbid, 'low');
    if (added) {
      queued++;
    }
  }

  // Start queue processing if items were queued
  if (queued > 0) {
    console.log(`🚀 Starting prefetch queue with ${queued} items`);

    // Start queue in background (non-blocking)
    prefetchQueue.start(async (mbid: string) => {
      await fetchAndCacheReleaseGroup(mbid, prefetchCountry);

      // Log progress periodically
      const stats = prefetchQueue.getStats();
      logProgress(stats);
    });
  }

  console.log(`📊 Prefetch: ${queued} queued, ${alreadyCached} already cached`);

  return { queued, alreadyCached };
}

/**
 * Get current prefetch status
 */
export function getPrefetchStatus(): PrefetchStatus {
  const stats = prefetchQueue.getStats();
  return {
    ...stats,
    isRunning: isPrefetching(),
  };
}

/**
 * Check if prefetch is currently running
 */
export function isPrefetching(): boolean {
  const stats = prefetchQueue.getStats();
  return stats.processing > 0 || stats.highPriority > 0 || stats.lowPriority > 0;
}
