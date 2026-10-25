/**
 * @ai-file cache
 * @ai-description Coordinator for release, release group, streaming links and URL check caches
 * @ai-dependencies database, release-store, release-group-cache, streaming-links-cache
 * @ai-features
 * - Opens the SQLite cache database at server start
 * - Imports the JSON cache files of older versions once (nothing is fetched again)
 * - Every write goes straight to the database, so there is no periodic save and no shutdown save
 * - Provides aggregate statistics
 * - Singleton export for app-wide use
 */

import { getCacheDatabase } from './database';
import { releaseStore } from './release-store';
import { releaseGroupCache } from './release-group-cache';
import { streamingLinksCache, urlCheckCache } from './streaming-links-cache';
import { AggregateStats } from '../types/cache';

/**
 * Cache manager coordinates the caches
 * Handles initialization and aggregate statistics
 */
class CacheManager {
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Open the database and import legacy JSON caches
   * Runs once at server start (instrumentation.ts); concurrent callers share the same promise
   */
  initialize(): Promise<void> {
    this.initPromise ??= this.openAll();
    return this.initPromise;
  }

  private async openAll(): Promise<void> {
    console.log('🚀 Initializing cache manager...');
    getCacheDatabase();

    // Sequential: each import is one database transaction
    for (const cache of [releaseStore, releaseGroupCache, streamingLinksCache, urlCheckCache]) {
      await cache.importLegacyFile();
    }

    this.initialized = true;
    console.log('✅ Cache manager initialized');
  }

  /**
   * Get aggregate statistics across all caches
   */
  getAggregateStats(): AggregateStats {
    const releaseStats = releaseStore.getStats();
    const rgStats = releaseGroupCache.getStats();
    const streamingStats = streamingLinksCache.getStats();

    const totalMemoryMB = releaseStats.memoryMB + rgStats.memoryMB + streamingStats.memoryMB;
    const totalHits = releaseStats.hits + rgStats.hits + streamingStats.hits;
    const totalMisses = releaseStats.misses + rgStats.misses + streamingStats.misses;
    const combinedHitRate = totalHits + totalMisses > 0
      ? totalHits / (totalHits + totalMisses)
      : 0;

    return {
      releaseGroups: rgStats,
      releases: releaseStats,
      streamingLinks: streamingStats,
      overall: {
        totalMemoryMB,
        combinedHitRate,
      },
    };
  }

  /**
   * Check if cache manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance - persisted across Next.js module re-evaluations
const globalForCache = globalThis as unknown as { cacheManager: CacheManager };
export const cacheManager = globalForCache.cacheManager ?? (globalForCache.cacheManager = new CacheManager());
