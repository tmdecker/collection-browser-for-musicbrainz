/**
 * @ai-file utility
 * @ai-description Shared rate limiter for Odesli (song.link) API calls
 * @ai-features
 * - Single source of truth for Odesli rate limiting across all API routes
 * - 6-second delay for Odesli API requirements (10 requests/minute)
 * - Serial slots shared via globalThis (see rate-limiter.ts)
 */

import { createRateLimiter } from './rate-limiter';

// Odesli API requires minimum 6-second delay between requests (10 req/min)
export const ODESLI_RATE_LIMIT_MS = 6000;

/**
 * Wait for rate limit before making Odesli API request
 * Enforces minimum delay between consecutive requests, also when they arrive concurrently
 *
 * @param rateLimitMs - Optional custom rate limit in milliseconds (default: 6000ms)
 */
export const waitForOdesliRateLimit = createRateLimiter('__odesliRateLimiterQueue', ODESLI_RATE_LIMIT_MS).wait;
