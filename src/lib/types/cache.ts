/**
 * @ai-file types
 * @ai-description Server-side cache type definitions
 * @ai-dependencies music.ts (imports Release, ReleaseGroup, StreamingLinks)
 * @ai-features
 * - CachedRelease with parent RG reference
 * - CachedReleaseGroup with MBID references (not full objects)
 * - HydratedReleaseGroup for API responses
 * - CacheStats for monitoring
 */

import { Release, ReleaseGroup, StreamingLinks, Genre, Tag, Rating, ArtistCredit } from '@/types/music';

/**
 * Release stored in cache with parent reference for reverse lookups
 * Extends standard Release with cache metadata
 */
export interface CachedRelease extends Release {
  releaseGroupId: string;  // Parent RG MBID for reverse lookups
  _cachedAt: number;        // Unix timestamp in milliseconds
  _expiresAt: number;       // Unix timestamp in milliseconds (30-day TTL)
}

/**
 * Release group stored in cache with MBID references instead of full release objects
 * This prevents data duplication - releases are stored once in ReleaseStore
 */
export interface CachedReleaseGroup {
  id: string;
  title: string;
  primary_type?: string;
  secondary_types?: string[];
  first_release_date?: string;
  disambiguation?: string;
  artist_credit: ArtistCredit[];

  // References to releases (NOT full objects)
  releaseMbids: string[];     // Array of release MBIDs
  bestReleaseMbid?: string;   // MBID of preferred release for details

  // Cached data
  cover?: string;
  genres?: string[] | Genre[];
  tags?: string[] | Tag[];
  rating?: Rating;
  streamingLinks?: StreamingLinks;

  // Cache metadata
  _cachedAt: number;          // Unix timestamp in milliseconds
  _expiresAt: number;         // Unix timestamp in milliseconds (30-day TTL)
}

/**
 * Fully hydrated release group with complete release objects
 * This is what gets returned to clients after fetching from cache
 */
export interface HydratedReleaseGroup extends Omit<CachedReleaseGroup, 'releaseMbids' | 'bestReleaseMbid'> {
  releases: Release[];         // Full release objects from ReleaseStore
  bestRelease?: Release;       // Full preferred release object
  tracklist?: any[];          // Tracks from bestRelease
  selectedReleaseId?: string; // For UI state
  releaseDetails?: Release;   // Detailed release data
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  entries: number;      // Number of cached items
  hits: number;         // Cache hit count
  misses: number;       // Cache miss count
  hitRate: number;      // Hit rate percentage (0-1)
  memoryMB: number;     // Memory usage in MB
  oldestEntry?: string; // ISO timestamp of oldest cache entry
}

/**
 * Cached streaming links from Odesli API with metadata
 */
export interface CachedStreamingLinks {
  streamingLinks: StreamingLinks;  // Platform links (spotify, appleMusic, etc.)
  sourceUrl: string;                // Original streaming URL that worked
  userCountry: string;              // User country for region-specific links
  _cachedAt: number;                // Unix timestamp in milliseconds
  _expiresAt: number;               // Unix timestamp in milliseconds (7-day TTL)
}

/**
 * Aggregate statistics across all caches
 */
export interface AggregateStats {
  releaseGroups: CacheStats;
  releases: CacheStats;
  streamingLinks: CacheStats;
  overall: {
    totalMemoryMB: number;
    combinedHitRate: number;
  };
}
