/**
 * @ai-file prefetch
 * @ai-description Prefetch service for background release group fetching
 * @ai-dependencies cache-manager, release-group-cache, release-store, prefetch-queue, rate-limiter
 * @ai-features
 * - Background prefetching of release groups after collection loads
 * - Filters already-cached RGs before queueing
 * - Retry logic with exponential backoff for network errors
 * - Progress logging every 60 seconds
 */

import { cacheManager } from '../cache/cache-manager';
import { releaseGroupCache } from '../cache/release-group-cache';
import { releaseStore } from '../cache/release-store';
import { prefetchQueue, type QueueStats } from './prefetch-queue';
import { getUserAgent } from '@/utils/config/userAgent';
import { waitForRateLimit } from '../rate-limiter';
import { Release, Track, Media } from '@/types/music';

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
    await waitForRateLimit();
    const response = await fetch(url, options);
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
 * Select the preferred release from a list of releases
 * Priority: Official status first, then oldest release date
 */
function selectPreferredRelease(releases: Release[]): Release | null {
  if (!releases || releases.length === 0) return null;

  const officialReleases = releases.filter(r => r.status === 'Official');
  const candidates = officialReleases.length > 0 ? officialReleases : releases;

  const sorted = [...candidates].sort((a, b) => {
    const dateA = a.date || '9999-99-99';
    const dateB = b.date || '9999-99-99';
    return dateA.localeCompare(dateB);
  });

  return sorted[0];
}

/**
 * Extract tracks from media array
 */
function extractTracksFromMedia(media: Media[]): Track[] {
  if (!media || media.length === 0) return [];

  const tracks: Track[] = [];
  media.forEach(medium => {
    if (medium.tracks) {
      tracks.push(...medium.tracks);
    }
  });

  return tracks;
}

/**
 * Fetch and cache a single release group
 * This is the core fetch function used by the prefetch queue
 */
async function fetchAndCacheReleaseGroup(mbid: string): Promise<void> {
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

    // Step 5: Store in caches
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

    // Store release group with MBID references
    releaseGroupCache.set(mbid, {
      ...releaseGroup,
      releaseMbids: releases.map((r: Release) => r.id),
      bestReleaseMbid: preferredRelease.id,
      cover: `/api/coverart/release-group/${mbid}/front`,
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
export async function startPrefetchForCollection(rgMbids: string[]): Promise<{ queued: number; alreadyCached: number }> {
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
      await fetchAndCacheReleaseGroup(mbid);

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
