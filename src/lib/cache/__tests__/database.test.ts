import { promises as fs, statSync } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkpointCacheDatabase, openCacheDatabase, type CacheDatabase } from '@/lib/cache/database';

let dir: string;
let db: CacheDatabase;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-db-'));
  db = openCacheDatabase(path.join(dir, 'cache.db'));
});

afterEach(async () => {
  db.close();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('openCacheDatabase', () => {
  it('uses WAL with synchronous NORMAL and a 64 MB WAL size limit', () => {
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('synchronous', { simple: true })).toBe(1); // NORMAL
    expect(db.pragma('journal_size_limit', { simple: true })).toBe(64 * 1024 * 1024);
  });
});

describe('checkpointCacheDatabase', () => {
  it('truncates the WAL file after a batch of writes', () => {
    const insert = db.prepare(
      'INSERT INTO cache_entries (cache, key, value, group_key, fetched_at, fresh_until) VALUES (?, ?, ?, NULL, 0, 0)'
    );
    const value = 'x'.repeat(4000);
    db.transaction(() => {
      for (let i = 0; i < 500; i++) insert.run('test', `key-${i}`, value);
    })();
    const walFile = path.join(dir, 'cache.db-wal');
    expect(statSync(walFile).size).toBeGreaterThan(1024 * 1024);

    checkpointCacheDatabase(db);

    expect(statSync(walFile).size).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM cache_entries').get()).toEqual({ n: 500 });
  });
});
