/**
 * @ai-file utility
 * @ai-description Shared rate limiter for MusicBrainz API calls
 * @ai-features
 * - Single source of truth for rate limiting across all API routes
 * - Configurable delay (default 2000ms for MusicBrainz requirements)
 * - Serial slots: concurrent callers are spaced out, never released together
 * - State on globalThis, so every route bundle shares one limiter (like the caches)
 */

interface RateLimiterState {
  nextSlot: number; // Earliest timestamp the next request may start
}

const getState = (key: string): RateLimiterState => {
  const store = globalThis as typeof globalThis & Record<string, RateLimiterState | undefined>;
  return (store[key] ??= { nextSlot: 0 });
};

/**
 * Creates a limiter that hands out request slots at least `defaultGapMs` apart
 * Each caller reserves its slot synchronously, so concurrent callers queue up instead of
 * reading the same timestamp and firing at once
 */
export function createRateLimiter(key: string, defaultGapMs: number) {
  const wait = async (gapMs = defaultGapMs): Promise<void> => {
    const state = getState(key);
    const now = Date.now();
    const slot = Math.max(now, state.nextSlot);
    state.nextSlot = slot + gapMs;

    if (slot > now) {
      await new Promise(resolve => setTimeout(resolve, slot - now));
    }
  };

  /**
   * Pushes all future slots back, e.g. after a 503 or a Retry-After header
   */
  const backOff = (delayMs: number): void => {
    const state = getState(key);
    state.nextSlot = Math.max(state.nextSlot, Date.now() + delayMs);
  };

  return { wait, backOff };
}

// MusicBrainz API requires minimum 2-second delay between requests
export const MUSICBRAINZ_RATE_LIMIT_MS = 2000;

const musicBrainzLimiter = createRateLimiter('__musicBrainzRateLimiter', MUSICBRAINZ_RATE_LIMIT_MS);

/**
 * Wait for rate limit before making MusicBrainz API request
 * Enforces minimum delay between consecutive requests, also when they arrive concurrently
 *
 * @param rateLimitMs - Optional custom rate limit in milliseconds (default: 2000ms)
 */
export const waitForRateLimit = musicBrainzLimiter.wait;

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
