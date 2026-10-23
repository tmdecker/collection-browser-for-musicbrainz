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

  it('lets high-priority requests go ahead of waiting low-priority ones (B13)', async () => {
    const limiter = newLimiter(1000);
    const order: string[] = [];

    const calls = [
      limiter.wait('low').then(() => order.push('prefetch-1')),
      limiter.wait('low').then(() => order.push('prefetch-2')),
      limiter.wait('low').then(() => order.push('prefetch-3')),
    ];
    // A user click arrives while the prefetch requests are queued
    calls.push(limiter.wait('high').then(() => order.push('click')));

    await vi.runAllTimersAsync();
    await Promise.all(calls);

    expect(order).toEqual(['prefetch-1', 'click', 'prefetch-2', 'prefetch-3']);
  });

  it('applies a back-off to requests that are already waiting', async () => {
    const limiter = newLimiter(1000);
    const start = Date.now();
    await limiter.wait();

    const released = limiter.wait().then(() => Date.now() - start);
    limiter.backOff(5000);
    await vi.runAllTimersAsync();

    expect(await released).toBe(5000);
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

describe('backOffMusicBrainz', () => {
  it("logs MusicBrainz's 503 reason without consuming the response body", async () => {
    vi.useRealTimers();
    const { backOffMusicBrainz } = await import('@/lib/rate-limiter');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = new Response('<p>Your requests are exceeding the allowable rate limit.</p>', {
      status: 503,
      headers: { 'retry-after': '1', 'x-ratelimit-limit': '1900', 'x-ratelimit-remaining': '0' },
    });

    backOffMusicBrainz(response);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    expect(warn.mock.calls[0][0]).toContain('pausing requests for 1s. Reason: Your requests are exceeding the allowable rate limit.');
    expect(warn.mock.calls[0][0]).toContain('X-RateLimit remaining 0/1900');
    expect(await response.text()).toContain('exceeding');
    warn.mockRestore();
  });
});
