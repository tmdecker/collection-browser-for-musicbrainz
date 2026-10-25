import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseCache, jitteredTtlMs } from '@/lib/cache/base-cache';
import { openCacheDatabase, setCacheDatabase } from '@/lib/cache/database';

const DAY_S = 24 * 60 * 60;
const DAY_MS = DAY_S * 1000;

class TestCache extends BaseCache<{ title: string; group?: string; _cachedAt?: number; _expiresAt?: number }> {
  constructor(ttlSeconds = 60 * DAY_S) {
    super('test-cache', ttlSeconds);
  }

  protected override groupKeyOf(value: { group?: string }): string | null {
    return value.group ?? null;
  }

  byGroup(group: string) {
    return this.getByGroup(group);
  }
}

let dir: string;
let cache: TestCache;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'base-cache-'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  setCacheDatabase(openCacheDatabase(':memory:'));
  cache = new TestCache();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('BaseCache storage', () => {
  it('round-trips entries through the database', () => {
    cache.set('a', { title: 'OK Computer' });
    expect(cache.get('a')).toEqual({ title: 'OK Computer' });
    expect(cache.has('a')).toBe(true);
    expect(new TestCache().get('a')).toEqual({ title: 'OK Computer' });

    cache.delete('a');
    expect(cache.has('a')).toBe(false);
  });

  it('writes to a database file right away, so a restart keeps every entry', async () => {
    const file = path.join(dir, 'data', 'cache.db');
    const db = openCacheDatabase(file);
    setCacheDatabase(db);
    cache.set('a', { title: 'Kid A' });
    db.close();

    setCacheDatabase(openCacheDatabase(file));
    expect(new TestCache().get('a')).toEqual({ title: 'Kid A' });
  });

  it('looks entries up by group key', () => {
    cache.set('r1', { title: 'CD', group: 'rg-1' });
    cache.set('r2', { title: 'Vinyl', group: 'rg-1' });
    cache.set('r3', { title: 'Other', group: 'rg-2' });
    expect(cache.byGroup('rg-1').map(release => release.title).sort()).toEqual(['CD', 'Vinyl']);
  });
});

describe('BaseCache stale-while-revalidate', () => {
  it('keeps serving an entry past its fresh time and reports it as stale', () => {
    const now = Date.now();
    cache.set('a', { title: 'first' }, 60);

    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    expect(cache.get('a')).toEqual({ title: 'first' });
    expect(cache.isStale('a')).toBe(true);
    expect(cache.getFresh('a')).toBeUndefined();
    expect(cache.getStats()).toMatchObject({ entries: 1, stale: 1 });
  });

  it('spreads fresh times of a day or more by ±15%, short ones stay exact', () => {
    expect(jitteredTtlMs(60, () => 0)).toBe(60_000);
    expect(jitteredTtlMs(60 * DAY_S, () => 0)).toBe(Math.round(60 * DAY_MS * 0.85));
    expect(jitteredTtlMs(60 * DAY_S, () => 1)).toBe(Math.round(60 * DAY_MS * 1.15));
  });

  it('makes a stale entry fresh again when it is stored again', () => {
    const now = Date.now();
    cache.set('a', { title: 'old' }, 60);
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    cache.set('a', { title: 'new' }, 60);
    expect(cache.isStale('a')).toBe(false);
    expect(cache.get('a')).toEqual({ title: 'new' });
  });
});

describe('BaseCache legacy JSON import', () => {
  const legacyFile = () => path.join(dir, '.cache', 'test-cache.json');
  const writeLegacy = async (data: unknown) => {
    await fs.mkdir(path.dirname(legacyFile()), { recursive: true });
    await fs.writeFile(legacyFile(), JSON.stringify(data));
  };

  it('imports every entry, expired ones as stale, and renames the file', async () => {
    const now = Date.now();
    await writeLegacy({
      version: 2,
      entries: {
        fresh: { value: { title: 'fresh', _cachedAt: now - DAY_MS }, expiresAt: now + 29 * DAY_MS },
        old: { value: { title: 'old', _cachedAt: now - 90 * DAY_MS }, expiresAt: now - 60 * DAY_MS },
      },
    });

    await cache.importLegacyFile();

    expect(cache.get('fresh')).toMatchObject({ title: 'fresh' });
    expect(cache.isStale('fresh')).toBe(false);
    expect(cache.get('old')).toMatchObject({ title: 'old' });
    expect(cache.isStale('old')).toBe(true);
    await expect(fs.access(legacyFile())).rejects.toThrow();
    await expect(fs.access(`${legacyFile()}.imported`)).resolves.toBeUndefined();
  });

  it('gives imported entries this cache’s jittered fresh time, short-lived ones keep their expiry', async () => {
    const now = Date.now();
    await writeLegacy({
      version: 2,
      entries: {
        album: { value: { title: 'album', _cachedAt: now }, expiresAt: now + 30 * DAY_MS },
        failed: { value: { title: 'failed lookup', _cachedAt: now }, expiresAt: now + 3_600_000 },
      },
    });

    await cache.importLegacyFile();

    expect(cache.freshUntil('album')).toBeGreaterThanOrEqual(now + 51 * DAY_MS - 1);
    expect(cache.freshUntil('album')).toBeLessThanOrEqual(now + 69 * DAY_MS + 1);
    expect(cache.freshUntil('failed')).toBe(now + 3_600_000);
  });

  it('reads old-format files and never overwrites entries already in the database', async () => {
    cache.set('a', { title: 'new' });
    await writeLegacy({ a: { title: 'old' }, b: { title: 'no expiry field' } });

    await cache.importLegacyFile();

    expect(cache.get('a')).toEqual({ title: 'new' });
    expect(cache.get('b')).toEqual({ title: 'no expiry field' });
  });
});
