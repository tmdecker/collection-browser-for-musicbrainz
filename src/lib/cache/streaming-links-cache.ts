/**
 * @ai-file cache
 * @ai-description Server-side cache for Odesli (song.link) streaming links
 * @ai-dependencies base-cache, StreamingLinks type
 * @ai-features
 * - Caches Odesli API responses with 7-day TTL
 * - Cache key includes source URL and user country
 * - Singleton pattern via globalThis for persistence across Next.js module re-evaluations
 */

import { BaseCache } from './base-cache';
import { CachedStreamingLinks } from '../types/cache';

/**
 * Cache for streaming links from Odesli API
 * Stores responses keyed by `${sourceUrl}:${userCountry}`
 */
class StreamingLinksCache extends BaseCache<CachedStreamingLinks> {
  constructor() {
    // 7-day TTL (same as client-side cache)
    super('streaming-links', 604800); // 7 days in seconds
  }

  /**
   * Generate cache key from source URL and user country
   * Fixes userCountry validation bug by including country in key
   */
  getCacheKey(sourceUrl: string, userCountry: string): string {
    return `${sourceUrl}:${userCountry}`;
  }

  /**
   * Get cached streaming links by source URL and country
   */
  getByUrl(sourceUrl: string, userCountry: string = 'DE'): CachedStreamingLinks | undefined {
    const key = this.getCacheKey(sourceUrl, userCountry);
    return this.get(key);
  }

  /**
   * Store streaming links by source URL and country
   */
  setByUrl(sourceUrl: string, userCountry: string, links: CachedStreamingLinks): void {
    const key = this.getCacheKey(sourceUrl, userCountry);
    this.set(key, links);
  }
}

// Singleton instance - persisted across Next.js module re-evaluations
const globalForStreamingLinks = globalThis as unknown as { streamingLinksCache: StreamingLinksCache };
export const streamingLinksCache = globalForStreamingLinks.streamingLinksCache ?? (globalForStreamingLinks.streamingLinksCache = new StreamingLinksCache());
