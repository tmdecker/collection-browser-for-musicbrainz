/**
 * @ai-file cache
 * @ai-description Server-side cache for streaming links (per album and per barcode)
 * @ai-dependencies base-cache, StreamingLinks type
 * @ai-features
 * - Album results keyed by release group and country (getRgStreamingLinks / setRgStreamingLinks)
 * - Barcode lookups keyed by barcode, configured providers and country
 * - Fresh for 30 days when complete, 1 hour when a provider failed; stale album results are still
 *   served while they are refreshed in the background, stale barcode results are looked up again
 * - URL liveness checks (urlCheckCache), keyed by URL, fresh for 30 days
 * - Singleton pattern via globalThis for persistence across Next.js module re-evaluations
 */

import { BaseCache } from './base-cache';
import { CachedStreamingLinks } from '../types/cache';
import { StreamingLinks } from '@/types/music';

// Links rarely change; a stale result is refreshed in the background the next time it is used
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
   * Cached streaming links only while fresh (barcode lookups are repeated once stale)
   */
  getFreshByUrl(source: string, userCountry: string): CachedStreamingLinks | undefined {
    return this.getFresh(this.getCacheKey(source, userCountry));
  }

  /**
   * True when the entry exists but is past its fresh time
   */
  isStaleByUrl(source: string, userCountry: string): boolean {
    return this.isStale(this.getCacheKey(source, userCountry));
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
 * True when the album's cached streaming links should be refreshed (they are still usable)
 */
export const isRgStreamingLinksStale = (releaseGroupMbid: string, country: string): boolean =>
  streamingLinksCache.isStaleByUrl(rgSource(releaseGroupMbid), country);

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

/**
 * Drop the cached streaming links of an album for every country (manual album refresh)
 */
export const deleteRgStreamingLinks = (releaseGroupMbid: string): void => {
  const prefix = `${rgSource(releaseGroupMbid)}:`;
  for (const key of streamingLinksCache.keys()) {
    if (key.startsWith(prefix)) streamingLinksCache.delete(key);
  }
};

// --- URL liveness checks ---

const URL_CHECK_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Whether a streaming URL answered (true) or is gone (false), keyed by URL, so releases and
 * albums that share a link share the check
 */
class UrlCheckCache extends BaseCache<{ valid: boolean }> {
  constructor() {
    super('url-checks', URL_CHECK_TTL_SECONDS);
  }
}

const globalForUrlChecks = globalThis as unknown as { urlCheckCache: UrlCheckCache };
export const urlCheckCache = globalForUrlChecks.urlCheckCache ?? (globalForUrlChecks.urlCheckCache = new UrlCheckCache());
