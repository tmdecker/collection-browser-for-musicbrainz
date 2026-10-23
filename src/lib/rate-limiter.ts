/**
 * @ai-file utility
 * @ai-description Shared rate limiter for MusicBrainz API calls
 * @ai-features
 * - Single source of truth for rate limiting across all API routes
 * - Configurable delay (default 1100ms, MusicBrainz allows 1 request/second)
 * - Serial queue: concurrent callers are spaced out, never released together
 * - Two priorities: user requests ('high') go ahead of background prefetch ('low')
 * - State on globalThis, so every route bundle shares one limiter (like the caches)
 */

export type RateLimitPriority = 'high' | 'low';

interface Waiter {
  resolve: () => void;
  gapMs: number;
}

interface RateLimiterState {
  nextSlot: number; // Earliest timestamp the next request may start
  high: Waiter[];
  low: Waiter[];
  timer: ReturnType<typeof setTimeout> | null;
}

const getState = (key: string): RateLimiterState => {
  const store = globalThis as typeof globalThis & Record<string, RateLimiterState | undefined>;
  return (store[key] ??= { nextSlot: 0, high: [], low: [], timer: null });
};

/**
 * Creates a limiter that releases requests at least `defaultGapMs` apart
 * Waiting requests are queued; when a slot opens, the oldest high-priority request goes first
 */
export function createRateLimiter(key: string, defaultGapMs: number) {
  // Release the next waiter once its slot has come; picks at release time, so a high-priority
  // request that arrives while low ones are waiting still goes next
  const pump = (state: RateLimiterState): void => {
    if (state.timer || (state.high.length === 0 && state.low.length === 0)) {
      return;
    }

    const delay = state.nextSlot - Date.now();
    if (delay > 0) {
      state.timer = setTimeout(() => {
        state.timer = null;
        pump(state);
      }, delay);
      return;
    }

    const waiter = (state.high.shift() ?? state.low.shift())!;
    state.nextSlot = Date.now() + waiter.gapMs;
    waiter.resolve();
    pump(state);
  };

  const wait = (priority: RateLimitPriority = 'high', gapMs = defaultGapMs): Promise<void> => {
    const state = getState(key);
    return new Promise(resolve => {
      (priority === 'high' ? state.high : state.low).push({ resolve, gapMs });
      pump(state);
    });
  };

  /**
   * Pushes all future slots back, e.g. after a 503 or a Retry-After header
   */
  const backOff = (delayMs: number): void => {
    const state = getState(key);
    state.nextSlot = Math.max(state.nextSlot, Date.now() + delayMs);
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    pump(state);
  };

  return { wait, backOff };
}

// MusicBrainz allows an average of 1 request per second per IP; 1.1 s leaves a small margin
export const MUSICBRAINZ_RATE_LIMIT_MS = 1100;

const musicBrainzLimiter = createRateLimiter('__musicBrainzRateLimiterQueue', MUSICBRAINZ_RATE_LIMIT_MS);

/**
 * Wait for rate limit before making MusicBrainz API request
 * Enforces minimum delay between consecutive requests, also when they arrive concurrently
 *
 * @param priority - 'high' for requests a user is waiting on (default), 'low' for background prefetch
 */
export const waitForRateLimit = (priority: RateLimitPriority = 'high'): Promise<void> =>
  musicBrainzLimiter.wait(priority);

/**
 * Pause all MusicBrainz requests after MusicBrainz answered 503 (rate limited)
 * Uses the Retry-After header when present, otherwise 10 seconds
 */
export function backOffMusicBrainz(response: Response): void {
  const retryAfterSeconds = Number(response.headers.get('retry-after'));
  const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 10000;
  console.warn(`⚠️  MusicBrainz rate limit hit (503), pausing requests for ${delayMs / 1000}s`);
  musicBrainzLimiter.backOff(delayMs);
}
