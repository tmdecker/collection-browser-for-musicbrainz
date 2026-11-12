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

// Pause after a 503 without Retry-After: long when this IP used up its budget, short when MusicBrainz
// is busy overall (budget left), since waiting longer does not help there and only stalls every request
const RATE_LIMITED_PAUSE_MS = 10000;
const SERVER_BUSY_PAUSE_MS = 2000;

/**
 * Pause all MusicBrainz requests after MusicBrainz answered 503
 * Uses the Retry-After header when present, otherwise 10 seconds when this IP is over its rate limit
 * and 2 seconds when MusicBrainz is busy overall (X-RateLimit-Remaining above 0)
 */
export function backOffMusicBrainz(response: Response): void {
  const retryAfterSeconds = Number(response.headers.get('retry-after'));
  const remaining = response.headers.get('x-ratelimit-remaining');
  const limit = response.headers.get('x-ratelimit-limit');
  const serverBusy = remaining !== null && Number(remaining) > 0;
  const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds * 1000
    : serverBusy ? SERVER_BUSY_PAUSE_MS : RATE_LIMITED_PAUSE_MS;
  musicBrainzLimiter.backOff(delayMs);

  // Log MusicBrainz's reason: it says whether this IP is too fast or the server is busy overall
  // (read from a clone, so callers can still use the response body)
  response
    .clone()
    .text()
    .catch(() => '')
    .then(body => {
      const reason = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || 'no reason given';
      const budget = limit ? `, X-RateLimit remaining ${remaining}/${limit}` : '';
      const kind = serverBusy ? 'MusicBrainz busy (503, rate budget left)' : 'MusicBrainz rate limit hit (503)';
      console.warn(`⚠️  ${kind}, pausing requests for ${delayMs / 1000}s. Reason: ${reason}${budget}`);
    });
}
