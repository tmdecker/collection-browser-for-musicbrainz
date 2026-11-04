/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as db from '@/utils/db';
import { ReleaseGroup } from '@/types/music';

describe('getCollection', () => {
  beforeAll(async () => {
    // No IndexedDB in the test environment: the cache runs in memory
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await db.initDatabase();
  });

  it('keeps albums whose cached details expired (they still belong to the collection)', async () => {
    const day = 24 * 60 * 60 * 1000;
    // Details opened long ago: expired
    await db.storeReleaseGroup({ id: 'rg-old', title: 'Old' } as ReleaseGroup);
    vi.setSystemTime(Date.now() + 40 * day);

    await db.storeCollection(
      [{ id: 'rg-old', title: 'Old' }, { id: 'rg-new', title: 'New' }] as ReleaseGroup[],
      'series-1', 'A series', 'series'
    );

    const albums = await db.getCollection('series-1');
    expect(albums.map(a => a.id)).toEqual(['rg-old', 'rg-new']);
    // A details lookup still treats the old entry as expired
    expect(await db.getReleaseGroup('rg-old')).toBeNull();
    vi.useRealTimers();
  });
});
