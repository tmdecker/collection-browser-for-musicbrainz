/**
 * @ai-file cache
 * @ai-description SQLite database that holds all server caches (one file, write-through)
 * @ai-dependencies better-sqlite3, fs, path
 * @ai-features
 * - One table for every cache: value, fetch time and the time the entry stops being fresh
 * - release_choices: the release the user picked for an album; not a cache, never expires or gets cleared
 * - WAL mode: every write is on disk right away, so a crash or deploy loses nothing
 * - WAL file capped: journal_size_limit truncates it after a checkpoint, and a TRUNCATE checkpoint
 *   after big batch jobs (start-up import, prefetch run) empties it
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
  CREATE TABLE IF NOT EXISTS release_choices (
    release_group_id TEXT    PRIMARY KEY,
    release_id       TEXT    NOT NULL,
    chosen_at        INTEGER NOT NULL
  ) WITHOUT ROWID;
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
  // Without a limit the -wal file never shrinks: it stays at its largest size since the last open
  db.pragma(`journal_size_limit = ${WAL_SIZE_LIMIT_BYTES}`);
  db.exec(SCHEMA);
  return db;
};

const WAL_SIZE_LIMIT_BYTES = 64 * 1024 * 1024;

/**
 * Copy the WAL into the database file and truncate it to zero bytes
 * Call after a batch of writes; cheap when the WAL is already small. Never throws: when a reader
 * blocks the checkpoint (busy), the next one or SQLite's automatic checkpoint catches up
 */
export const checkpointCacheDatabase = (db: CacheDatabase = getCacheDatabase()): void => {
  try {
    const [result] = db.pragma('wal_checkpoint(TRUNCATE)') as { busy: number; log: number; checkpointed: number }[];
    if (result?.busy) {
      console.warn('⚠️ Cache database checkpoint was blocked by a reader; WAL not truncated');
    }
  } catch (error) {
    console.error('❌ Cache database checkpoint failed:', error);
  }
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
