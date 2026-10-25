/**
 * @ai-file cache
 * @ai-description Shared storage for individual releases, looked up by MBID or by release group
 * @ai-dependencies base-cache, cache types
 * @ai-features
 * - Stores releases once, referenced by multiple release groups
 * - Each release is stored with its release group as group key (indexed lookup by group)
 * - Bulk fetch operations
 * - Singleton export for app-wide use
 */

import { BaseCache } from './base-cache';
import { CachedRelease } from '../types/cache';

// Album data (release group, releases, tracklist) rarely changes; genres, tags and ratings
// arrive fresh with the daily collection list anyway
export const ALBUM_DATA_TTL_SECONDS = 60 * 24 * 60 * 60;

/**
 * Release store
 * Stores individual releases that can be referenced by multiple release groups
 */
class ReleaseStore extends BaseCache<CachedRelease> {
  constructor() {
    super('releases', ALBUM_DATA_TTL_SECONDS);
  }

  protected override groupKeyOf(release: CachedRelease): string | null {
    return release.releaseGroupId ?? null;
  }

  /**
   * Get all releases for a release group
   */
  getByReleaseGroup(rgMbid: string): CachedRelease[] {
    return this.getByGroup(rgMbid);
  }

  /**
   * Get multiple releases by their MBIDs
   */
  getBulk(mbids: string[]): CachedRelease[] {
    const releases: CachedRelease[] = [];
    for (const mbid of mbids) {
      const release = this.get(mbid);
      if (release) {
        releases.push(release);
      }
    }
    return releases;
  }

  /**
   * Check if all releases for a release group are cached
   */
  hasAllReleasesForGroup(rgMbid: string, expectedMbids: string[]): boolean {
    return expectedMbids.every(mbid => this.has(mbid));
  }
}

// Singleton instance - persisted across Next.js module re-evaluations
const globalForReleaseStore = globalThis as unknown as { releaseStore: ReleaseStore };
export const releaseStore = globalForReleaseStore.releaseStore ?? (globalForReleaseStore.releaseStore = new ReleaseStore());
