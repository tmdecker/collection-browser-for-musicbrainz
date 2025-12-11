/**
 * @ai-file utility
 * @ai-description Shared rate limiter for Odesli (song.link) API calls
 * @ai-features
 * - Single source of truth for Odesli rate limiting across all API routes
 * - 6-second delay for Odesli API requirements (10 requests/minute)
 * - Singleton pattern via module state
 */

// Shared state across all API routes and prefetch operations
let lastRequestTime = 0;

// Odesli API requires minimum 6-second delay between requests (10 req/min)
export const ODESLI_RATE_LIMIT_MS = 6000;

/**
 * Wait for rate limit before making Odesli API request
 * Enforces minimum delay between consecutive requests
 *
 * @param rateLimitMs - Optional custom rate limit in milliseconds (default: 6000ms)
 */
export async function waitForOdesliRateLimit(rateLimitMs = ODESLI_RATE_LIMIT_MS): Promise<void> {
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
