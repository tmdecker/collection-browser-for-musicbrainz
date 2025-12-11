/**
 * @ai-file cache
 * @ai-description Coordinator for both release and release group caches
 * @ai-dependencies release-store, release-group-cache
 * @ai-features
 * - Initializes both caches from disk
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

    // Restore both caches from disk
    await Promise.all([
      releaseStore.restore(),
      releaseGroupCache.restore(),
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
   * Persist both caches to disk
   */
  async persistAll(): Promise<void> {
    console.log('💾 Persisting all caches...');
    await Promise.all([
      releaseStore.persist(),
      releaseGroupCache.persist(),
    ]);
    console.log('✅ All caches persisted');
  }

  /**
   * Get aggregate statistics across both caches
   */
  getAggregateStats(): AggregateStats {
    const releaseStats = releaseStore.getStats();
    const rgStats = releaseGroupCache.getStats();

    const totalMemoryMB = releaseStats.memoryMB + rgStats.memoryMB;
    const totalHits = releaseStats.hits + rgStats.hits;
    const totalMisses = releaseStats.misses + rgStats.misses;
    const combinedHitRate = totalHits + totalMisses > 0
      ? totalHits / (totalHits + totalMisses)
      : 0;

    return {
      releaseGroups: rgStats,
      releases: releaseStats,
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

// Singleton instance
export const cacheManager = new CacheManager();
