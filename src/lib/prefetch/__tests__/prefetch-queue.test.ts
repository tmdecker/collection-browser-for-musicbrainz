import { describe, expect, it } from 'vitest';
import { prefetchQueue } from '@/lib/prefetch/prefetch-queue';

describe('prefetchQueue (B7)', () => {
  it('processes high priority first and stops when empty', async () => {
    const order: string[] = [];
    prefetchQueue.add('low-1', 'low');
    prefetchQueue.add('high-1', 'high');

    await prefetchQueue.start(async mbid => {
      order.push(mbid);
    });

    expect(order).toEqual(['high-1', 'low-1']);
    expect(prefetchQueue.getStats().lowPriority).toBe(0);
  });

  it('accepts an item again after it was processed (e.g. its cache entry expired)', async () => {
    const seen: string[] = [];
    const fetchFn = async (mbid: string) => {
      seen.push(mbid);
    };

    expect(prefetchQueue.add('rg-1')).toBe(true);
    expect(prefetchQueue.add('rg-1')).toBe(false); // Already queued
    await prefetchQueue.start(fetchFn);

    expect(prefetchQueue.add('rg-1')).toBe(true);
    await prefetchQueue.start(fetchFn);
    expect(seen).toEqual(['rg-1', 'rg-1']);
  });

  it('keeps going after a failed item', async () => {
    const seen: string[] = [];
    prefetchQueue.add('fails');
    prefetchQueue.add('works');

    await prefetchQueue.start(async mbid => {
      seen.push(mbid);
      if (mbid === 'fails') throw new Error('MusicBrainz down');
    });

    expect(seen).toEqual(['fails', 'works']);
  });
});
