/**
 * @ai-file cache
 * @ai-description Abstract base class for server-side caches stored in SQLite (stale-while-revalidate)
 * @ai-dependencies database, fs, path
 * @ai-features
 * - Generic type-safe cache over one SQLite table (see database.ts), written through on every set
 * - Entries are never deleted for age: past their fresh time they are "stale" and still served,
 *   while callers refresh them in the background
 * - Fresh times get ±15% random jitter, so entries fetched together do not all go stale together
 * - Optional group key per entry (e.g. a release's release group) for lookups by group
 * - One-time import of the JSON files written by older versions (.cache/<name>.json)
 * - Hit/miss statistics tracking
 */

import fs from 'fs/promises';
import path from 'path';
import { CacheStats } from '../types/cache';
import { getCacheDatabase, getDataDir } from './database';

// Older versions stored each cache as one JSON file; version 2 stores each entry's expiry
const LEGACY_FORMAT_VERSION = 2;

interface LegacyEntry<T> {
  value: T;
  expiresAt: number; // Timestamp in ms, 0 = no expiry
}

interface LegacyCacheFile<T> {
  version: typeof LEGACY_FORMAT_VERSION;
  entries: Record<string, LegacyEntry<T>>;
}

/**
 * Normalizes both legacy file formats to entries with an expiry (null = unknown)
 * Version 1 files fall back to the entry's own _expiresAt field when it has one
 */
export const toLegacyEntries = <T>(
  data: LegacyCacheFile<T> | Record<string, T>
): Record<string, { value: T; expiresAt: number | null }> => {
  if ((data as LegacyCacheFile<T>).version === LEGACY_FORMAT_VERSION) {
    const entries = (data as LegacyCacheFile<T>).entries;
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

// Fresh times of a day or longer are spread by ±15%; shorter ones (failure retries) stay exact
const JITTER = 0.15;
const MIN_JITTER_TTL_SECONDS = 24 * 60 * 60;

export const jitteredTtlMs = (ttlSeconds: number, random: () => number = Math.random): number => {
  const ms = ttlSeconds * 1000;
  return ttlSeconds < MIN_JITTER_TTL_SECONDS ? ms : Math.round(ms * (1 - JITTER + 2 * JITTER * random()));
};

interface Row {
  value: string;
  fresh_until: number;
}

/**
 * Abstract base class for all cache implementations
 */
export abstract class BaseCache<T> {
  protected stats = { hits: 0, misses: 0 };
  protected name: string;
  protected ttlSeconds: number;

  /**
   * @param name - Cache name (row prefix in the database, and the legacy JSON file name)
   * @param ttlSeconds - How long an entry stays fresh
   */
  constructor(name: string, ttlSeconds: number) {
    this.name = name;
    this.ttlSeconds = ttlSeconds;
  }

  protected get db() {
    return getCacheDatabase();
  }

  /**
   * Group key stored with an entry (null = none); subclasses override it to look entries up by group
   */
  protected groupKeyOf(_value: T): string | null {
    return null;
  }

  private row(key: string): Row | undefined {
    return this.db
      .prepare('SELECT value, fresh_until FROM cache_entries WHERE cache = ? AND key = ?')
      .get(this.name, key) as Row | undefined;
  }

  /**
   * Get value from cache, fresh or stale, with hit/miss tracking
   */
  get(key: string): T | undefined {
    const row = this.row(key);
    if (row) {
      this.stats.hits++;
      return JSON.parse(row.value) as T;
    }
    this.stats.misses++;
    return undefined;
  }

  /**
   * Get value only while it is fresh (for data that must be fetched again once stale)
   */
  getFresh(key: string): T | undefined {
    const row = this.row(key);
    if (row && row.fresh_until > Date.now()) {
      this.stats.hits++;
      return JSON.parse(row.value) as T;
    }
    this.stats.misses++;
    return undefined;
  }

  /**
   * True when the entry exists but is past its fresh time (callers refresh it in the background)
   */
  isStale(key: string): boolean {
    const row = this.row(key);
    return !!row && row.fresh_until <= Date.now();
  }

  /**
   * When the entry stops being fresh (ms timestamp), or undefined when it is not cached
   */
  freshUntil(key: string): number | undefined {
    return this.row(key)?.fresh_until;
  }

  /**
   * Store value in cache (written to disk right away)
   * @param ttlSeconds - How long this entry stays fresh (default: the cache's TTL), jittered
   */
  set(key: string, value: T, ttlSeconds: number = this.ttlSeconds): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO cache_entries (cache, key, value, group_key, fetched_at, fresh_until) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (cache, key) DO UPDATE SET value = excluded.value, group_key = excluded.group_key,
           fetched_at = excluded.fetched_at, fresh_until = excluded.fresh_until`
      )
      .run(this.name, key, JSON.stringify(value), this.groupKeyOf(value), now, now + jitteredTtlMs(ttlSeconds));
  }

  /**
   * Check if key exists in cache (fresh or stale)
   */
  has(key: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM cache_entries WHERE cache = ? AND key = ?').get(this.name, key);
  }

  /**
   * Delete key from cache
   */
  delete(key: string): void {
    this.db.prepare('DELETE FROM cache_entries WHERE cache = ? AND key = ?').run(this.name, key);
  }

  /**
   * Values of all entries with this group key
   */
  protected getByGroup(groupKey: string): T[] {
    const rows = this.db
      .prepare('SELECT value FROM cache_entries WHERE cache = ? AND group_key = ?')
      .all(this.name, groupKey) as { value: string }[];
    return rows.map(row => JSON.parse(row.value) as T);
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    const rows = this.db.prepare('SELECT key FROM cache_entries WHERE cache = ?').all(this.name) as { key: string }[];
    return rows.map(row => row.key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.db.prepare('DELETE FROM cache_entries WHERE cache = ?').run(this.name);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totals = this.db
      .prepare(
        `SELECT COUNT(*) AS entries, COALESCE(SUM(fresh_until <= ?), 0) AS stale,
           COALESCE(SUM(LENGTH(value)), 0) AS bytes, MIN(fetched_at) AS oldest
         FROM cache_entries WHERE cache = ?`
      )
      .get(Date.now(), this.name) as { entries: number; stale: number; bytes: number; oldest: number | null };
    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      entries: totals.entries,
      stale: totals.stale,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      memoryMB: totals.bytes / (1024 * 1024),
      oldestEntry: totals.oldest ? new Date(totals.oldest).toISOString() : undefined,
    };
  }

  /**
   * Import the JSON file an older version wrote (.cache/<name>.json), then rename it to *.imported
   * Expired entries are imported too (as stale), so the upgrade fetches nothing again; entries
   * already in the database are never overwritten
   */
  async importLegacyFile(): Promise<void> {
    const legacyPath = path.join(process.cwd(), '.cache', `${this.name}.json`);
    let content: string;
    try {
      content = await fs.readFile(legacyPath, 'utf-8');
    } catch {
      return; // Nothing to import
    }

    try {
      const entries = toLegacyEntries<T>(JSON.parse(content));
      const now = Date.now();
      const insert = this.db.prepare(
        `INSERT OR IGNORE INTO cache_entries (cache, key, value, group_key, fetched_at, fresh_until)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const ttlMs = this.ttlSeconds * 1000;
      let imported = 0;
      this.db.transaction(() => {
        for (const [key, { value, expiresAt }] of Object.entries(entries)) {
          const cachedAt = (value as { _cachedAt?: unknown })?._cachedAt;
          const fetchedAt = typeof cachedAt === 'number' ? cachedAt : now;
          // Short-lived entries (failed lookups) keep their expiry; the rest get this cache's
          // jittered fresh time, so a collection loaded in one go does not go stale in one go
          const freshUntil = expiresAt !== null && expiresAt - fetchedAt < ttlMs / 2
            ? expiresAt
            : fetchedAt + jitteredTtlMs(this.ttlSeconds);
          imported += insert.run(this.name, key, JSON.stringify(value), this.groupKeyOf(value), fetchedAt, freshUntil).changes;
        }
      })();
      await fs.rename(legacyPath, `${legacyPath}.imported`);
      console.log(`✅ Imported ${imported} ${this.name} entries from ${legacyPath} into ${path.join(getDataDir(), 'cache.db')}`);
    } catch (error) {
      console.error(`❌ Failed to import ${legacyPath}:`, error);
    }
  }
}
