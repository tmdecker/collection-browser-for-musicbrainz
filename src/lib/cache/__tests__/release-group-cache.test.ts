import { describe, expect, it } from 'vitest';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { releaseStore } from '@/lib/cache/release-store';
import { CachedReleaseGroup } from '@/lib/types/cache';

const album = (id: string, releaseMbids: string[]) =>
  ({ id, title: id, releaseMbids, _cachedAt: Date.now(), _expiresAt: Date.now() + 1000 }) as unknown as CachedReleaseGroup;

describe('releaseGroupCache.isComplete', () => {
  it('needs every release, each with url-rels (relations)', () => {
    releaseStore.set('r-new', { id: 'r-new', title: 'A', relations: [] } as never);
    releaseStore.set('r-old', { id: 'r-old', title: 'A' } as never);

    releaseGroupCache.set('complete', album('complete', ['r-new']));
    releaseGroupCache.set('old-format', album('old-format', ['r-new', 'r-old']));
    releaseGroupCache.set('missing-release', album('missing-release', ['r-new', 'r-gone']));

    expect(releaseGroupCache.isComplete('complete')).toBe(true);
    // Fully cached, but a click would fetch it again for the url-rels
    expect(releaseGroupCache.isFullyCached('old-format')).toBe(true);
    expect(releaseGroupCache.isComplete('old-format')).toBe(false);
    expect(releaseGroupCache.isComplete('missing-release')).toBe(false);
    expect(releaseGroupCache.isComplete('not-cached')).toBe(false);
  });
});
