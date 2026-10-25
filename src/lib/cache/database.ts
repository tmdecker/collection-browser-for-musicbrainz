/**
 * @ai-file cache
 * @ai-description SQLite database that holds all server caches (one file, write-through)
 * @ai-dependencies better-sqlite3, fs, path
 * @ai-features
 * - One table for every cache: value, fetch time and the time the entry stops being fresh
 * - WAL mode: every write is on disk right away, so a crash or deploy loses nothing
 * - File location: DATA_DIR/cache.db (default .cache/ in the app folder)
 * - Singleton on globalThis, so every route bundle shares one connection
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';

export type CacheDatabase = Database.Database;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS cache_entries (
    cache       TEXT    NOT NULL,
    key         TEXT    NOT NULL,
    value       TEXT    NOT NULL,
    group_key   TEXT,
    fetched_at  INTEGER NOT NULL,
    fresh_until INTEGER NOT NULL,
    PRIMARY KEY (cache, key)
  ) WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS cache_entries_group ON cache_entries (cache, group_key);
  CREATE INDEX IF NOT EXISTS cache_entries_fresh ON cache_entries (cache, fresh_until);
`;

/**
 * Directory for the database (and nothing else); outside the git checkout is safest on a server
 */
export const getDataDir = (): string => process.env.DATA_DIR || path.join(process.cwd(), '.cache');

/**
 * Open a database file (or ':memory:') and create the schema
 */
export const openCacheDatabase = (file: string): CacheDatabase => {
  if (file !== ':memory:') {
    mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL'); // Safe with WAL: a power cut may lose the last commit, never corrupt the file
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
};

const store = globalThis as typeof globalThis & { __cacheDatabase?: CacheDatabase };

/**
 * The shared database, opened on first use
 */
export const getCacheDatabase = (): CacheDatabase =>
  (store.__cacheDatabase ??= openCacheDatabase(path.join(getDataDir(), 'cache.db')));

/**
 * Replace the shared database (tests use an in-memory one)
 */
export const setCacheDatabase = (db: CacheDatabase): void => {
  store.__cacheDatabase = db;
};
