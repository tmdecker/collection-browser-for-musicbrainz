/**
 * @ai-file prefetch
 * @ai-description Prefetch service for release groups and streaming links
 * @ai-dependencies cache-manager, release-group-cache, release-store, album-streaming-links, prefetch-queue, rate-limiter
 * @ai-features
 * - Background prefetching of release groups after collection loads
 * - Streaming links prefetch (MusicBrainz links of all releases + barcode lookups)
 * - Filters already-cached RGs before queueing; albums cached without url-rels count as uncached
 * - Albums without streaming links for the country get them from the cached releases
 * - Stale albums are queued last for a refresh
 * - Retry logic with exponential backoff for network errors
 * - Progress logging every 60 seconds
 */

import { cacheManager } from '../cache/cache-manager';
import { ALBUM_DATA_TTL_SECONDS, releaseGroupCache } from '../cache/release-group-cache';
import { releaseStore } from '../cache/release-store';
import { prefetchQueue, type QueueStats } from './prefetch-queue';
import { getUserAgent } from '@/utils/config/userAgent';
import { getAlbumStreamingLinks } from '../album-streaming-links';
import { getRgStreamingLinks } from '../cache/streaming-links-cache';
import { releaseGroupFetchInFlight, withReleaseGroupFetch } from '../cache/release-group-fetches';
import { browseAllReleases } from '../browse-releases';
import { waitForRateLimit, backOffMusicBrainz } from '../rate-limiter';
import { Release } from '@/types/music';
import { selectPreferredRelease } from '@/utils/release-selection';

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
 * Fetch and cache a single release group, then resolve its streaming links
 * This is the core fetch function used by the prefetch queue
 */
async function fetchAndCacheReleaseGroup(mbid: string, country: string): Promise<void> {
  // A click is loading this album already: let it finish instead of fetching it a second time
  const inFlight = releaseGroupFetchInFlight(mbid);
  if (inFlight) {
    await inFlight;
  }

  // Album data complete and fresh (a click may just have loaded it): at most the streaming links of
  // this country are missing, resolved from the cached releases; stale albums are fetched again below
  if (releaseGroupCache.isComplete(mbid) && !releaseGroupCache.isStale(mbid)) {
    if (!getRgStreamingLinks(mbid, country)) {
      try {
        await getAlbumStreamingLinks(mbid, country, { priority: 'low' });
      } catch (error) {
        console.warn(`⚠️  Failed to fetch streaming links for ${mbid}:`, error);
      }
    }
    return;
  }

  // Marked as in flight only while MusicBrainz is queried, so a click waits for the album data,
  // not for the slower barcode lookups below
  const fetched = await withReleaseGroupFetch(mbid, () => fetchReleaseGroupData(mbid));
  if (!fetched) return;

  // Resolve streaming links (MusicBrainz links of all releases + barcode lookups) into the
  // album's streaming links cache entry, so the details panel gets them instantly
  try {
    await getAlbumStreamingLinks(mbid, country, { releases: fetched });
  } catch (error) {
    // Non-critical: log and continue if streaming links fail
    console.warn(`⚠️  Failed to fetch streaming links for ${mbid}:`, error);
  }
}

/**
 * Fetch a release group with all its releases from MusicBrainz and store it in the caches
 * @returns The releases for the streaming links lookup, or null when the group has no releases
 */
async function fetchReleaseGroupData(mbid: string): Promise<{ releases: Release[]; bestRelease: Release } | null> {
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

    // Step 2: Fetch all releases (browse returns 100 per page)
    const releases = await browseAllReleases(mbid, url =>
      fetchWithRetry(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': getUserAgent(),
        },
      })
    );

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
        _expiresAt: now + ALBUM_DATA_TTL_SECONDS * 1000,
      });
      return null;
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

    // Step 5: Store in caches
    const now = Date.now();
    const expiresAt = now + ALBUM_DATA_TTL_SECONDS * 1000;

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

    // Store release group with MBID references
    releaseGroupCache.set(mbid, {
      ...releaseGroup,
      releaseMbids: releases.map((r: Release) => r.id),
      bestReleaseMbid: preferredRelease.id,
      cover: `/api/coverart/release-group/${mbid}/front`,
      _cachedAt: now,
      _expiresAt: expiresAt,
    });

    return { releases, bestRelease: detailedRelease };
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

  // Uncached RGs first (including albums cached without url-rels, which a click would fetch again),
  // then albums without streaming links for this country, then stale ones (still served), oldest first
  const uncached: string[] = [];
  const missingLinks: string[] = [];
  const stale: { mbid: string; freshUntil: number }[] = [];
  let alreadyCached = 0;

  for (const mbid of rgMbids) {
    if (!releaseGroupCache.isComplete(mbid)) {
      uncached.push(mbid);
    } else if (releaseGroupCache.isStale(mbid)) {
      stale.push({ mbid, freshUntil: releaseGroupCache.freshUntil(mbid) ?? 0 });
    } else if (!getRgStreamingLinks(mbid, country)) {
      missingLinks.push(mbid);
    } else {
      alreadyCached++;
    }
  }
  stale.sort((a, b) => a.freshUntil - b.freshUntil);

  // Add to queue with low priority
  let queued = 0;
  for (const mbid of [...uncached, ...missingLinks, ...stale.map(item => item.mbid)]) {
    const added = prefetchQueue.add(mbid, 'low');
    if (added) {
      queued++;
    }
  }

  if (queued > 0) {
    console.log(`🚀 Starting prefetch queue with ${queued} items (${uncached.length} new, ${missingLinks.length} without streaming links, ${stale.length} to refresh)`);
    startQueue();
  }

  console.log(`📊 Prefetch: ${queued} queued, ${alreadyCached} already cached`);

  return { queued, alreadyCached };
}

/**
 * Start queue processing in the background (non-blocking; does nothing while it runs)
 */
function startQueue(): void {
  prefetchQueue.start(async (mbid: string) => {
    await fetchAndCacheReleaseGroup(mbid, prefetchCountry);

    // Log progress periodically
    const stats = prefetchQueue.getStats();
    logProgress(stats);
  });
}

/**
 * Refresh a stale album in the background (a click was just served the stale copy)
 * Skipped when background prefetch is turned off (PREFETCH_ENABLED=false)
 */
export function queueReleaseGroupRefresh(mbid: string): void {
  if (process.env.PREFETCH_ENABLED === 'false') return;
  if (prefetchQueue.add(mbid, 'low')) {
    startQueue();
  }
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
