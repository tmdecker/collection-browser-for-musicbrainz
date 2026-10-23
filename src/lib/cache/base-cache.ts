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
import { mkdirSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import { CacheStats } from '../types/cache';

// Version 2 stores each entry's expiry; version 1 files were a plain key -> value map
const PERSIST_FORMAT_VERSION = 2;

interface PersistedEntry<T> {
  value: T;
  expiresAt: number; // Timestamp in ms, 0 = no expiry
}

interface PersistedCacheFile<T> {
  version: typeof PERSIST_FORMAT_VERSION;
  entries: Record<string, PersistedEntry<T>>;
}

/**
 * Normalizes both file formats to entries with an expiry (null = unknown)
 * Old files fall back to the entry's own _expiresAt field when it has one
 */
const toPersistedEntries = <T>(
  data: PersistedCacheFile<T> | Record<string, T>
): Record<string, { value: T; expiresAt: number | null }> => {
  if ((data as PersistedCacheFile<T>).version === PERSIST_FORMAT_VERSION) {
    const entries = (data as PersistedCacheFile<T>).entries;
    return Object.fromEntries(
      Object.entries(entries).map(([key, entry]) => [key, { value: entry.value, expiresAt: entry.expiresAt || null }])
    );
  }

  return Object.fromEntries(
    Object.entries(data as Record<string, T>).map(([key, value]) => {
      const ownExpiry = (value as { _expiresAt?: unknown })?._expiresAt;
      return [key, { value, expiresAt: typeof ownExpiry === 'number' ? ownExpiry : null }];
    })
  );
};

/**
 * Abstract base class for all cache implementations
 * Provides common caching operations with persistence support
 */
export abstract class BaseCache<T> {
  protected cache: NodeCache;
  protected persistPath: string;
  protected stats = { hits: 0, misses: 0 };
  protected name: string;
  // Approximate serialized size per key, updated on writes so getStats() stays cheap
  private entrySizes = new Map<string, number>();
  private totalBytes = 0;

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

    this.cache.on('set', (key: string, value: unknown) => {
      const size = JSON.stringify(value)?.length ?? 0;
      this.totalBytes += size - (this.entrySizes.get(key) ?? 0);
      this.entrySizes.set(key, size);
    });
    const forget = (key: string) => {
      this.totalBytes -= this.entrySizes.get(key) ?? 0;
      this.entrySizes.delete(key);
    };
    this.cache.on('del', forget);
    this.cache.on('expired', forget);
    this.cache.on('flush', () => {
      this.entrySizes.clear();
      this.totalBytes = 0;
    });
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

    // Rough memory estimate from sizes tracked on write (serializing the whole cache here
    // cost megabytes of work on every 10 s stats poll)
    const memoryMB = this.totalBytes / (1024 * 1024);

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
      await fs.mkdir(path.dirname(this.persistPath), { recursive: true });

      // Write to a temp file, then rename over the old one: rename is atomic, so a crash
      // or Ctrl+C mid-write leaves the previous file intact instead of a truncated one
      const { json, count } = this.serialize();
      const tmpPath = this.tempPath();
      await fs.writeFile(tmpPath, json, 'utf-8');
      await fs.rename(tmpPath, this.persistPath);
      console.log(`✅ Persisted ${count} ${this.name} entries to ${this.persistPath}`);
    } catch (error) {
      console.error(`❌ Failed to persist ${this.name} cache:`, error);
    }
  }

  /**
   * Synchronous persist for shutdown: async writes do not finish before the process exits
   */
  persistSync(): void {
    try {
      mkdirSync(path.dirname(this.persistPath), { recursive: true });
      const { json, count } = this.serialize();
      const tmpPath = this.tempPath();
      writeFileSync(tmpPath, json, 'utf-8');
      renameSync(tmpPath, this.persistPath);
      console.log(`✅ Persisted ${count} ${this.name} entries to ${this.persistPath}`);
    } catch (error) {
      console.error(`❌ Failed to persist ${this.name} cache:`, error);
    }
  }

  private tempPath(): string {
    return `${this.persistPath}.${process.pid}.tmp`;
  }

  /**
   * All entries with their real expiry, so a restart does not reset TTLs
   */
  private serialize(): { json: string; count: number } {
    const entries: Record<string, PersistedEntry<T>> = {};
    for (const key of this.cache.keys()) {
      const value = this.cache.get<T>(key);
      if (value !== undefined) {
        entries[key] = { value, expiresAt: this.cache.getTtl(key) || 0 };
      }
    }
    const data: PersistedCacheFile<T> = { version: PERSIST_FORMAT_VERSION, entries };
    return { json: JSON.stringify(data), count: Object.keys(entries).length };
  }

  /**
   * Delete temp files left by a server that was stopped mid-write (the real file is intact)
   */
  private async removeStaleTempFiles(): Promise<void> {
    const cacheDir = path.dirname(this.persistPath);
    const prefix = `${path.basename(this.persistPath)}.`;
    try {
      const files = await fs.readdir(cacheDir);
      await Promise.all(
        files
          .filter(file => file.startsWith(prefix) && file.endsWith('.tmp'))
          .map(file => fs.rm(path.join(cacheDir, file), { force: true }))
      );
    } catch {
      // No cache directory yet
    }
  }

  /**
   * Restore cache from disk
   * Note: Subclasses may override this to add custom restoration logic (e.g., rebuilding indexes)
   */
  async restore(): Promise<void> {
    await this.removeStaleTempFiles();

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
      const data: PersistedCacheFile<T> | Record<string, T> = JSON.parse(fileContent);
      const now = Date.now();

      // Restore entries to cache with their remaining TTL, skipping expired ones
      let restoredCount = 0;
      let expiredCount = 0;
      for (const [key, { value, expiresAt }] of Object.entries(toPersistedEntries(data))) {
        // Never overwrite an entry written since startup with older data from disk
        if (this.cache.has(key)) continue;

        if (expiresAt === null) {
          this.cache.set(key, value); // Unknown expiry (old file format): default TTL
        } else if (expiresAt > now) {
          this.cache.set(key, value, Math.ceil((expiresAt - now) / 1000));
        } else {
          expiredCount++;
          continue;
        }
        restoredCount++;
      }

      console.log(`✅ Restored ${restoredCount} ${this.name} entries from ${this.persistPath}${expiredCount ? ` (${expiredCount} expired, skipped)` : ''}`);
    } catch (error) {
      console.error(`❌ Failed to restore ${this.name} cache:`, error);
    }
  }
}
