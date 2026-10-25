/**
 * @ai-file cache
 * @ai-description Server-side cache for streaming links (per album and per barcode)
 * @ai-dependencies base-cache, StreamingLinks type
 * @ai-features
 * - Album results keyed by release group and country (getRgStreamingLinks / setRgStreamingLinks)
 * - Barcode lookups keyed by barcode, configured providers and country
 * - 30-day TTL for complete results (like the album data), 1 hour when a provider failed, so failures are retried soon
 * - Singleton pattern via globalThis for persistence across Next.js module re-evaluations
 */

import { BaseCache } from './base-cache';
import { CachedStreamingLinks } from '../types/cache';
import { StreamingLinks } from '@/types/music';

// Same as the release group cache, so the prefetch (which skips cached albums) never leaves links expired
export const STREAMING_LINKS_TTL_SECONDS = 30 * 24 * 60 * 60;
// A lookup where a provider timed out or failed is only kept briefly
export const STREAMING_LINKS_FAILURE_TTL_SECONDS = 60 * 60;

/**
 * Cache for streaming links
 * Stores entries keyed by `${source}:${userCountry}`
 */
class StreamingLinksCache extends BaseCache<CachedStreamingLinks> {
  constructor() {
    super('streaming-links', STREAMING_LINKS_TTL_SECONDS);
  }

  /**
   * Generate cache key from source and user country
   */
  getCacheKey(source: string, userCountry: string): string {
    return `${source}:${userCountry}`;
  }

  /**
   * Get cached streaming links by source and country
   */
  getByUrl(source: string, userCountry: string = 'DE'): CachedStreamingLinks | undefined {
    const key = this.getCacheKey(source, userCountry);
    return this.get(key);
  }

  /**
   * Store streaming links by source and country
   * @param complete - false when a provider failed: kept for 1 hour instead of 30 days
   */
  setByUrl(source: string, userCountry: string, links: StreamingLinks, complete: boolean): CachedStreamingLinks {
    const now = Date.now();
    const ttlSeconds = complete ? STREAMING_LINKS_TTL_SECONDS : STREAMING_LINKS_FAILURE_TTL_SECONDS;
    const entry: CachedStreamingLinks = {
      streamingLinks: links,
      sourceUrl: source,
      userCountry,
      complete,
      _cachedAt: now,
      _expiresAt: now + ttlSeconds * 1000,
    };
    this.set(this.getCacheKey(source, userCountry), entry, ttlSeconds);
    return entry;
  }
}

// Singleton instance - persisted across Next.js module re-evaluations
const globalForStreamingLinks = globalThis as unknown as { streamingLinksCache: StreamingLinksCache };
export const streamingLinksCache = globalForStreamingLinks.streamingLinksCache ?? (globalForStreamingLinks.streamingLinksCache = new StreamingLinksCache());

// --- Album results: the only access path, so the storage behind it can change later ---

const rgSource = (releaseGroupMbid: string) => `rg:${releaseGroupMbid}`;

/**
 * Cached streaming links of an album (release group); _cachedAt is when they were fetched
 */
export const getRgStreamingLinks = (releaseGroupMbid: string, country: string): CachedStreamingLinks | undefined =>
  streamingLinksCache.getByUrl(rgSource(releaseGroupMbid), country);

/**
 * Store the streaming links of an album (release group)
 * @param complete - false when a lookup failed: kept for 1 hour instead of 30 days
 */
export const setRgStreamingLinks = (
  releaseGroupMbid: string,
  country: string,
  links: StreamingLinks,
  complete: boolean
): CachedStreamingLinks => streamingLinksCache.setByUrl(rgSource(releaseGroupMbid), country, links, complete);
