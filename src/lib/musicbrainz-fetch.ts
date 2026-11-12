/**
 * @ai-file lib
 * @ai-description The one way the server talks to the MusicBrainz API
 * @ai-dependencies rate-limiter, network-errors, getUserAgent
 * @ai-features
 * - Every attempt waits for its slot in the shared rate limit ('high' for clicks, 'low' for background work)
 * - Timeout per attempt (30 s), so a hung connection never stalls a click or the prefetch queue
 * - 503 (MusicBrainz busy or this IP too fast): pauses all MusicBrainz requests (Retry-After) and tries again
 * - Network errors (unreachable, reset, timeout): tried again after 1 s, then 2 s
 * - User-Agent and Accept headers, the OAuth token when one is given
 * - After the last attempt the 503 response is returned and a network error is thrown, for the caller to report
 */

import { getUserAgent } from '@/utils/config/userAgent';
import { backOffMusicBrainz, waitForRateLimit, type RateLimitPriority } from './rate-limiter';
import { isNetworkError } from './network-errors';

export const MB_BASE_URL = 'https://musicbrainz.org/ws/2';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRIES = 2;
const NETWORK_RETRY_DELAYS_MS = [1000, 2000, 4000];

export interface MusicBrainzFetchOptions {
  /** 'high' for requests a user waits on (default), 'low' for background work */
  priority?: RateLimitPriority;
  /** OAuth access token (private collections, the user's own ratings) */
  accessToken?: string;
  /** Tries after the first one, for 503s and network errors (default 2) */
  retries?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * GET a MusicBrainz API URL with rate limiting, timeout and retries
 */
export async function musicBrainzFetch(url: string | URL, options: MusicBrainzFetchOptions = {}): Promise<Response> {
  const { priority = 'high', accessToken, retries = DEFAULT_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': getUserAgent() };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  for (let attempt = 0; ; attempt++) {
    await waitForRateLimit(priority);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
    } catch (error) {
      if (!isNetworkError(error) || attempt >= retries) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      const path = new URL(url.toString()).pathname;
      console.warn(`⚠️  MusicBrainz request failed (${reason}), attempt ${attempt + 1}/${retries + 1}: ${path}`);
      await sleep(NETWORK_RETRY_DELAYS_MS[Math.min(attempt, NETWORK_RETRY_DELAYS_MS.length - 1)]);
      continue;
    }

    if (response.status !== 503) return response;
    // Pauses every MusicBrainz request, so the next attempt's rate-limit slot comes after the pause
    backOffMusicBrainz(response);
    if (attempt >= retries) return response;
  }
}
