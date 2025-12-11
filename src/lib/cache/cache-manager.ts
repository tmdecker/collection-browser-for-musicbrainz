/**
 * @ai-file cache
 * @ai-description Coordinator for release, release group, and streaming links caches
 * @ai-dependencies release-store, release-group-cache, streaming-links-cache
 * @ai-features
 * - Initializes all caches from disk
 * - Coordinates persistence operations
 * - Periodic persistence every 5 minutes
 * - Graceful shutdown on process exit
 * - Provides aggregate statistics
 * - Singleton export for app-wide use
 */

import fs from 'fs/promises';
import path from 'path';
import { releaseStore } from './release-store';
import { releaseGroupCache } from './release-group-cache';
import { streamingLinksCache } from './streaming-links-cache';
import { AggregateStats } from '../types/cache';

const PERSIST_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cache manager coordinates both release and release group caches
 * Handles initialization, persistence, and aggregate statistics
 */
class CacheManager {
  private initialized = false;
  private persistInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize both caches by restoring from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('⚠️ Cache manager already initialized');
      return;
    }

    console.log('🚀 Initializing cache manager...');

    // Ensure cache directory exists
    await this.ensureCacheDir();

    // Restore all caches from disk
    await Promise.all([
      releaseStore.restore(),
      releaseGroupCache.restore(),
      streamingLinksCache.restore(),
    ]);

    this.initialized = true;
    this.startPeriodicPersistence();
    this.setupExitHandlers();
    console.log('✅ Cache manager initialized');
  }

  /**
   * Start periodic persistence to disk
   */
  private startPeriodicPersistence(): void {
    if (this.persistInterval) return;
    this.persistInterval = setInterval(() => {
      this.persistAll().catch(err => console.error('❌ Periodic persist failed:', err));
    }, PERSIST_INTERVAL_MS);
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupExitHandlers(): void {
    const gracefulShutdown = async () => {
      console.log('🛑 Graceful shutdown: persisting caches...');
      if (this.persistInterval) clearInterval(this.persistInterval);
      await this.persistAll();
      process.exit(0);
    };
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  /**
   * Persist all caches to disk
   */
  async persistAll(): Promise<void> {
    console.log('💾 Persisting all caches...');
    await Promise.all([
      releaseStore.persist(),
      releaseGroupCache.persist(),
      streamingLinksCache.persist(),
    ]);
    console.log('✅ All caches persisted');
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
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    const cacheDir = path.join(process.cwd(), '.cache');
    try {
      await fs.mkdir(cacheDir, { recursive: true });
    } catch (error) {
      console.error('❌ Failed to create cache directory:', error);
      throw error;
    }
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
