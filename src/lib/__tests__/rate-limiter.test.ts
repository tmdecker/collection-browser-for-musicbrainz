import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '@/lib/rate-limiter';

let keyCounter = 0;
const newLimiter = (gapMs: number) => createRateLimiter(`__testLimiter${keyCounter++}`, gapMs);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createRateLimiter', () => {
  it('spaces out concurrent callers instead of releasing them together', async () => {
    const limiter = newLimiter(2000);
    const start = Date.now();
    const releasedAt: number[] = [];

    const calls = [0, 1, 2].map(() => limiter.wait().then(() => releasedAt.push(Date.now() - start)));
    await vi.runAllTimersAsync();
    await Promise.all(calls);

    expect(releasedAt).toEqual([0, 2000, 4000]);
  });

  it('lets a request through immediately after an idle period', async () => {
    const limiter = newLimiter(2000);
    await limiter.wait();
    vi.advanceTimersByTime(5000);

    const before = Date.now();
    await limiter.wait();
    expect(Date.now()).toBe(before);
  });

  it('shares state between limiters created with the same key (route bundles)', async () => {
    const a = createRateLimiter('__sharedTestLimiter', 1000);
    const b = createRateLimiter('__sharedTestLimiter', 1000);
    const start = Date.now();

    const first = a.wait();
    const second = b.wait().then(() => Date.now() - start);
    await vi.runAllTimersAsync();
    await first;

    expect(await second).toBe(1000);
  });

  it('delays all future slots after a back-off', async () => {
    const limiter = newLimiter(2000);
    const start = Date.now();
    limiter.backOff(10000);

    const released = limiter.wait().then(() => Date.now() - start);
    await vi.runAllTimersAsync();

    expect(await released).toBe(10000);
  });
});
