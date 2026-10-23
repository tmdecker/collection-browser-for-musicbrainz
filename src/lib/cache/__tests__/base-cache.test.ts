import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseCache } from '@/lib/cache/base-cache';

class TestCache extends BaseCache<{ title: string }> {
  constructor() {
    super('test-cache', 60);
  }

  destroy(): void {
    this.cache.close();
  }
}

let dir: string;
let cache: TestCache;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'base-cache-'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  cache = new TestCache();
});

afterEach(async () => {
  cache.destroy();
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('BaseCache persistence', () => {
  it('round-trips entries through disk', async () => {
    cache.set('a', { title: 'OK Computer' });
    await cache.persist();

    const restored = new TestCache();
    await restored.restore();
    expect(restored.get('a')).toEqual({ title: 'OK Computer' });
    restored.destroy();
  });

  it('keeps the previous file intact when a write fails midway', async () => {
    cache.set('a', { title: 'first' });
    await cache.persist();
    const cacheFile = path.join(dir, '.cache', 'test-cache.json');
    const before = await fs.readFile(cacheFile, 'utf-8');

    cache.set('b', { title: 'second' });
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('killed during write'));
    await cache.persist();

    expect(await fs.readFile(cacheFile, 'utf-8')).toBe(before);
  });
});

describe('BaseCache expiry across restarts (B8)', () => {
  const cacheFile = () => path.join(dir, '.cache', 'test-cache.json');

  it('keeps the remaining TTL instead of granting a fresh one', async () => {
    cache.set('a', { title: 'first' });
    await cache.persist();

    // Restart 50 s later: 10 s of the 60 s TTL should be left
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 50_000);
    const restored = new TestCache();
    await restored.restore();
    const expiresAt = (restored as unknown as { cache: { getTtl: (k: string) => number } }).cache.getTtl('a');
    expect(expiresAt).toBeGreaterThan(realNow + 59_000);
    expect(expiresAt).toBeLessThanOrEqual(realNow + 61_000);
    restored.destroy();
  });

  it('skips entries that expired while the server was down', async () => {
    cache.set('a', { title: 'first' });
    await cache.persist();

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    const restored = new TestCache();
    await restored.restore();
    expect(restored.has('a')).toBe(false);
    restored.destroy();
  });

  it('reads old-format files, using _expiresAt when present', async () => {
    await fs.mkdir(path.dirname(cacheFile()), { recursive: true });
    await fs.writeFile(
      cacheFile(),
      JSON.stringify({
        fresh: { title: 'no expiry field' },
        stale: { title: 'expired', _expiresAt: Date.now() - 1000 },
      })
    );

    await cache.restore();
    expect(cache.get('fresh')).toEqual({ title: 'no expiry field' });
    expect(cache.has('stale')).toBe(false);
  });

  it('does not overwrite entries written before the restore finished (B10)', async () => {
    cache.set('a', { title: 'old' });
    await cache.persist();

    const restarted = new TestCache();
    restarted.set('a', { title: 'new' });
    await restarted.restore();
    expect(restarted.get('a')).toEqual({ title: 'new' });
    restarted.destroy();
  });

  it('reports memory from tracked sizes', () => {
    cache.set('a', { title: 'x'.repeat(1000) });
    expect(cache.getStats().memoryMB).toBeGreaterThan(0.0009);
    cache.delete('a');
    expect(cache.getStats().memoryMB).toBe(0);
  });
});

describe('BaseCache temp files', () => {
  it('removes temp files left by an interrupted write on restore', async () => {
    const cacheDir = path.join(dir, '.cache');
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(path.join(cacheDir, 'test-cache.json.12345.tmp'), '');
    await fs.writeFile(path.join(cacheDir, 'other-cache.json.12345.tmp'), '');

    await cache.restore();

    expect(await fs.readdir(cacheDir)).toEqual(['other-cache.json.12345.tmp']);
  });
});
