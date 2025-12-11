/**
 * @ai-file cache
 * @ai-description Release group cache with MBID references and hydration
 * @ai-dependencies base-cache, release-store, cache types
 * @ai-features
 * - Stores RG metadata with release MBID references (not full objects)
 * - Hydrates releases from ReleaseStore on fetch
 * - Checks cache completeness (RG + all releases)
 * - Singleton export for app-wide use
 */

import { BaseCache } from './base-cache';
import { releaseStore } from './release-store';
import { CachedReleaseGroup, HydratedReleaseGroup } from '../types/cache';
import { Release } from '@/types/music';

/**
 * Release group cache with MBID references
 * Stores release group metadata and references to releases (not full objects)
 */
class ReleaseGroupCache extends BaseCache<CachedReleaseGroup> {
  constructor() {
    super('release-groups', 30 * 24 * 60 * 60); // 30 days TTL
  }

  /**
   * Get release group with hydrated releases from ReleaseStore
   * This converts MBID references to full release objects
   */
  getWithReleases(rgMbid: string): HydratedReleaseGroup | undefined {
    const rg = this.get(rgMbid);
    if (!rg) return undefined;

    // Hydrate releases from store
    const releases: Release[] = releaseStore.getBulk(rg.releaseMbids);

    // Hydrate best release if specified
    const bestRelease = rg.bestReleaseMbid
      ? releaseStore.get(rg.bestReleaseMbid)
      : undefined;

    // Extract tracklist from best release if available
    const tracklist = bestRelease?.media?.flatMap(medium => medium.tracks || []);

    // Return hydrated release group
    return {
      ...rg,
      releases,
      bestRelease,
      tracklist,
      selectedReleaseId: rg.bestReleaseMbid,
      releaseDetails: bestRelease,
    };
  }

  /**
   * Check if release group and all its releases are fully cached
   */
  isFullyCached(rgMbid: string): boolean {
    const rg = this.get(rgMbid);
    if (!rg) return false;

    // Check if all referenced releases exist in store
    return rg.releaseMbids.every(mbid => releaseStore.has(mbid));
  }

  /**
   * Get cache status for a release group
   * Returns: { cached: boolean, missingReleases: string[] }
   */
  getCacheStatus(rgMbid: string): { cached: boolean; missingReleases: string[] } {
    const rg = this.get(rgMbid);
    if (!rg) {
      return { cached: false, missingReleases: [] };
    }

    const missingReleases = rg.releaseMbids.filter(mbid => !releaseStore.has(mbid));
    return {
      cached: missingReleases.length === 0,
      missingReleases,
    };
  }
}

// Singleton instance
export const releaseGroupCache = new ReleaseGroupCache();
