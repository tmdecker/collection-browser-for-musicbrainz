/**
 * @ai-file cache
 * @ai-description Shared storage for individual releases with reverse index
 * @ai-dependencies base-cache, cache types
 * @ai-features
 * - Stores releases once, referenced by multiple release groups
 * - Reverse index for efficient RG -> releases lookups
 * - Bulk fetch operations
 * - Singleton export for app-wide use
 */

import { BaseCache } from './base-cache';
import { CachedRelease } from '../types/cache';

/**
 * Release store with reverse index for efficient lookups
 * Stores individual releases that can be referenced by multiple release groups
 */
class ReleaseStore extends BaseCache<CachedRelease> {
  // Reverse index: releaseGroupId -> Set of release MBIDs
  private rgIndex: Map<string, Set<string>> = new Map();

  constructor() {
    super('releases', 30 * 24 * 60 * 60); // 30 days TTL
  }

  /**
   * Store release and update reverse index
   */
  override set(key: string, value: CachedRelease): void {
    super.set(key, value);
    this.addToIndex(value.releaseGroupId, key);
  }

  /**
   * Delete release and update reverse index
   */
  override delete(key: string): void {
    const release = this.get(key);
    if (release) {
      this.removeFromIndex(release.releaseGroupId, key);
    }
    super.delete(key);
  }

  /**
   * Clear all entries and rebuild index
   */
  override clear(): void {
    super.clear();
    this.rgIndex.clear();
  }

  /**
   * Get all releases for a release group
   */
  getByReleaseGroup(rgMbid: string): CachedRelease[] {
    const releaseMbids = this.rgIndex.get(rgMbid);
    if (!releaseMbids) return [];

    const releases: CachedRelease[] = [];
    for (const mbid of releaseMbids) {
      const release = this.get(mbid);
      if (release) {
        releases.push(release);
      }
    }
    return releases;
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

  /**
   * Add release MBID to reverse index
   */
  private addToIndex(rgMbid: string, releaseMbid: string): void {
    if (!this.rgIndex.has(rgMbid)) {
      this.rgIndex.set(rgMbid, new Set());
    }
    this.rgIndex.get(rgMbid)!.add(releaseMbid);
  }

  /**
   * Remove release MBID from reverse index
   */
  private removeFromIndex(rgMbid: string, releaseMbid: string): void {
    const releases = this.rgIndex.get(rgMbid);
    if (releases) {
      releases.delete(releaseMbid);
      if (releases.size === 0) {
        this.rgIndex.delete(rgMbid);
      }
    }
  }

  /**
   * Rebuild reverse index from all cached releases
   */
  private rebuildIndex(): void {
    this.rgIndex.clear();
    const keys = this.keys();
    for (const key of keys) {
      const release = this.get(key);
      if (release) {
        this.addToIndex(release.releaseGroupId, key);
      }
    }
    console.log(`🔄 Rebuilt reverse index for ${this.rgIndex.size} release groups`);
  }

  /**
   * Restore cache from disk and rebuild index
   */
  override async restore(): Promise<void> {
    await super.restore();
    this.rebuildIndex();
  }
}

// Singleton instance
export const releaseStore = new ReleaseStore();
