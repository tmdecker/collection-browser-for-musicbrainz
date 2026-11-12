/**
 * @ai-file prefetch
 * @ai-description Prefetch service for release groups and streaming links
 * @ai-dependencies cache-manager, release-group-cache, release-group-fetch, album-streaming-links, prefetch-queue
 * @ai-features
 * - Background prefetching of release groups after collection loads
 * - Streaming links prefetch (MusicBrainz links of all releases + barcode lookups)
 * - Filters already-cached RGs before queueing; albums cached without url-rels count as uncached
 * - Albums without streaming links for the country get them from the cached releases
 * - Stale albums are queued last for a refresh
 * - MusicBrainz requests through lib/musicbrainz-fetch (timeouts, 503 back-off and network retries)
 * - Progress logging every 60 seconds
 */

import { cacheManager } from '../cache/cache-manager';
import { releaseGroupCache } from '../cache/release-group-cache';
import { prefetchQueue, type QueueStats } from './prefetch-queue';
import { fetchAndStoreReleaseGroup } from '../release-group-fetch';
import { checkpointCacheDatabase } from '../cache/database';
import { getAlbumStreamingLinks } from '../album-streaming-links';
import { getRgStreamingLinks } from '../cache/streaming-links-cache';
import { releaseGroupFetchInFlight, withReleaseGroupFetch } from '../cache/release-group-fetches';
import { Release } from '@/types/music';

// Progress logging state
let lastLogTime = 0;
const LOG_INTERVAL_MS = 60000; // 60 seconds

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
    const { releases, preferredRelease, detailedRelease } = await fetchAndStoreReleaseGroup(mbid, 'low');
    if (!preferredRelease) return null;
    return { releases, bestRelease: detailedRelease ?? preferredRelease };
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
  if (prefetchQueue.running) return; // The running loop picks up new items
  void prefetchQueue.start(async (mbid: string) => {
    await fetchAndCacheReleaseGroup(mbid, prefetchCountry);

    // Log progress periodically
    const stats = prefetchQueue.getStats();
    logProgress(stats);
  }).then(() => {
    // Queue empty: a run can write hundreds of albums, so truncate the WAL now instead of leaving it large
    checkpointCacheDatabase();
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
