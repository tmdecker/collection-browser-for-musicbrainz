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
