/**
 * @ai-file lib
 * @ai-description Tells network failures (MusicBrainz unreachable) apart from API errors and bugs
 * @ai-features
 * - fetch failed, ECONNRESET, ECONNREFUSED and timeouts count as network errors
 */

/**
 * True for transient network errors (worth a retry or a 502), false for API errors and bugs
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'fetch failed') {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('econnreset') ||
           message.includes('econnrefused') ||
           message.includes('timeout');
  }
  return false;
}
