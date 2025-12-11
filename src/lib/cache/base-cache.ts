/**
 * @ai-file cache
 * @ai-description Abstract base class for server-side caching with persistence
 * @ai-dependencies node-cache, fs, path
 * @ai-features
 * - Generic type-safe cache wrapper around node-cache
 * - Automatic persistence to JSON files
 * - Hit/miss statistics tracking
 * - TTL management with configurable expiration
 */

import NodeCache from 'node-cache';
import fs from 'fs/promises';
import path from 'path';
import { CacheStats } from '../types/cache';

/**
 * Abstract base class for all cache implementations
 * Provides common caching operations with persistence support
 */
export abstract class BaseCache<T> {
  protected cache: NodeCache;
  protected persistPath: string;
  protected stats = { hits: 0, misses: 0 };
  protected name: string;

  /**
   * @param name - Cache name (used for persistence file)
   * @param ttlSeconds - Time to live in seconds
   */
  constructor(name: string, ttlSeconds: number) {
    this.name = name;
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false, // Don't clone objects for better performance
    });
    this.persistPath = path.join(process.cwd(), '.cache', `${name}.json`);
  }

  /**
   * Get value from cache with hit/miss tracking
   */
  get(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return value;
  }

  /**
   * Store value in cache
   */
  set(key: string, value: T): void {
    this.cache.set(key, value);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete key from cache
   */
  delete(key: string): void {
    this.cache.del(key);
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.flushAll();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const keys = this.cache.keys();
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Calculate memory usage (rough estimate)
    const allData = this.cache.mget(keys);
    const memoryBytes = JSON.stringify(allData).length;
    const memoryMB = memoryBytes / (1024 * 1024);

    // Find oldest entry
    let oldestTimestamp: number | undefined;
    for (const key of keys) {
      const value = this.cache.get<T & { _cachedAt?: number }>(key);
      if (value && value._cachedAt) {
        if (!oldestTimestamp || value._cachedAt < oldestTimestamp) {
          oldestTimestamp = value._cachedAt;
        }
      }
    }

    return {
      entries: keys.length,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      memoryMB,
      oldestEntry: oldestTimestamp ? new Date(oldestTimestamp).toISOString() : undefined,
    };
  }

  /**
   * Persist cache to disk as JSON
   */
  async persist(): Promise<void> {
    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(this.persistPath);
      await fs.mkdir(cacheDir, { recursive: true });

      // Get all cache data
      const keys = this.cache.keys();
      const data: Record<string, T> = {};
      for (const key of keys) {
        const value = this.cache.get<T>(key);
        if (value !== undefined) {
          data[key] = value;
        }
      }

      // Write to file
      await fs.writeFile(this.persistPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`✅ Persisted ${keys.length} ${this.name} entries to ${this.persistPath}`);
    } catch (error) {
      console.error(`❌ Failed to persist ${this.name} cache:`, error);
    }
  }

  /**
   * Restore cache from disk
   * Note: Subclasses may override this to add custom restoration logic (e.g., rebuilding indexes)
   */
  async restore(): Promise<void> {
    try {
      // Check if file exists
      try {
        await fs.access(this.persistPath);
      } catch {
        console.log(`📝 No cache file found at ${this.persistPath}, starting with empty cache`);
        return;
      }

      // Read and parse file
      const fileContent = await fs.readFile(this.persistPath, 'utf-8');
      const data: Record<string, T> = JSON.parse(fileContent);

      // Restore entries to cache
      let restoredCount = 0;
      for (const [key, value] of Object.entries(data)) {
        this.cache.set(key, value);
        restoredCount++;
      }

      console.log(`✅ Restored ${restoredCount} ${this.name} entries from ${this.persistPath}`);
    } catch (error) {
      console.error(`❌ Failed to restore ${this.name} cache:`, error);
    }
  }
}
