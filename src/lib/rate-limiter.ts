/**
 * @ai-file utility
 * @ai-description Shared rate limiter for MusicBrainz API calls
 * @ai-features
 * - Single source of truth for rate limiting across all API routes
 * - Configurable delay (default 2000ms for MusicBrainz requirements)
 * - Singleton pattern via module state
 */

// Shared state across all API routes and prefetch operations
let lastRequestTime = 0;

// MusicBrainz API requires minimum 2-second delay between requests
export const MUSICBRAINZ_RATE_LIMIT_MS = 2000;

/**
 * Wait for rate limit before making MusicBrainz API request
 * Enforces minimum delay between consecutive requests
 *
 * @param rateLimitMs - Optional custom rate limit in milliseconds (default: 2000ms)
 */
export async function waitForRateLimit(rateLimitMs = MUSICBRAINZ_RATE_LIMIT_MS): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < rateLimitMs) {
    const waitTime = rateLimitMs - elapsed;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Get timestamp of last request (for monitoring/testing)
 */
export function getLastRequestTime(): number {
  return lastRequestTime;
}
