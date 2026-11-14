/**
 * @ai-file lib
 * @ai-description Album details for one fixed release (release items of release collections and release series)
 * @ai-dependencies release-group-fetch, release-group-cache, release-store, prefetch-service, release-items
 * @ai-features
 * - Finds the release's release group (release cache, else one MusicBrainz lookup that also brings the tracklist)
 * - Loads the release group like a click on an album does (server cache, a running prefetch, else MusicBrainz)
 * - Answers in the shape of /api/release-groups, with this release as the one shown: its title, artists, date,
 *   tracklist and cover; rating, genres, reviews and links stay the release group's
 * - Never reads or writes the release chosen in the Releases tab (release_choices)
 * - refreshReleaseGroupNow: fetch a release group again and drop what was derived from the old data
 *   (shared with the manual refresh of /api/release-groups)
 */

import { Release } from '@/types/music';
import { releaseGroupCache } from './cache/release-group-cache';
import { releaseStore } from './cache/release-store';
import { releaseGroupFetchInFlight, withReleaseGroupFetch } from './cache/release-group-fetches';
import { deleteRgStreamingLinks } from './cache/streaming-links-cache';
import { deleteReviewUrls } from './review-links';
import { forgetCachedImage } from './image-cache';
import { MB_BASE_URL, musicBrainzFetch } from './musicbrainz-fetch';
import { queueReleaseGroupRefresh } from './prefetch/prefetch-service';
import { RateLimitPriority } from './rate-limiter';
import {
  FetchedReleaseGroup,
  fetchAndStoreReleaseGroup,
  fetchReleaseDetailsOrThrow,
  MusicBrainzResponseError,
} from './release-group-fetch';
import { pinnedReleaseOf, releaseItemCoverUrl } from '@/utils/release-items';

type RawRelease = Release & {
  title?: string;
  'release-group'?: { id?: string; 'primary-type'?: string; 'secondary-types'?: string[] };
  'artist-credit'?: unknown[];
};

const hasTracklist = (release: Release | undefined): boolean =>
  !!release?.media?.some(medium => medium.tracks?.length);

/**
 * Fetch a release group from MusicBrainz again, ignoring the cache, and drop what belonged to the old data:
 * releases that left the album, its streaming and review links and its cover images
 */
export async function refreshReleaseGroupNow(mbid: string): Promise<FetchedReleaseGroup> {
  // A fetch that started before the edit may finish after this refresh: let it finish first
  await releaseGroupFetchInFlight(mbid);

  const previousReleaseMbids = releaseGroupCache.get(mbid)?.releaseMbids ?? [];
  const fetched = await withReleaseGroupFetch(mbid, () => fetchAndStoreReleaseGroup(mbid, 'high'));

  // Releases that were removed or merged on MusicBrainz no longer belong to this album
  const currentReleaseMbids = new Set(releaseGroupCache.get(mbid)?.releaseMbids ?? []);
  for (const releaseMbid of previousReleaseMbids) {
    if (!currentReleaseMbids.has(releaseMbid)) releaseStore.delete(releaseMbid);
  }

  // Streaming links are resolved again from the new releases on the next request; the cover is
  // downloaded again (the "no cover" marker is dropped too); review links come from the new url-rels
  deleteRgStreamingLinks(mbid);
  deleteReviewUrls(mbid);
  forgetCachedImage(`https://coverartarchive.org/release-group/${mbid}/front`);
  return fetched;
}

/**
 * A release's release group and the facts a grid entry shows, from the release cache or one light lookup
 * (stored, so the details request later finds the release group without asking again)
 */
export async function lookUpReleaseItem(releaseId: string, priority: RateLimitPriority) {
  const cached = releaseStore.get(releaseId) as (RawRelease & { releaseGroupId?: string }) | undefined;
  let release: RawRelease;
  let releaseGroupId: string;

  if (cached?.releaseGroupId && cached.media?.length) {
    release = cached;
    releaseGroupId = cached.releaseGroupId;
  } else {
    const response = await musicBrainzFetch(
      `${MB_BASE_URL}/release/${releaseId}?fmt=json&inc=release-groups+media+labels+artist-credits`,
      { priority }
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new MusicBrainzResponseError(response.status, response.statusText);
    }
    release = await response.json();
    const id = release['release-group']?.id;
    if (!id) throw new MusicBrainzResponseError(404, 'Release without a release group');
    releaseGroupId = id;
    // Only a release the cache does not hold yet: never replace one that has its tracklist and links
    if (!cached) {
      const now = Date.now();
      releaseStore.set(releaseId, { ...release, releaseGroupId, _cachedAt: now, _expiresAt: now });
    }
  }

  const releaseGroup = release['release-group'];
  const cachedGroup = releaseGroupCache.get(releaseGroupId) as unknown as Record<string, unknown> | undefined;
  return {
    releaseGroupId,
    pinnedRelease: pinnedReleaseOf(release),
    cover: releaseItemCoverUrl(releaseId, releaseGroupId, release['cover-art-archive']),
    primary_type: releaseGroup?.['primary-type'] ?? (cachedGroup?.['primary-type'] as string | undefined),
    secondary_types: releaseGroup?.['secondary-types'] ?? (cachedGroup?.['secondary-types'] as string[] | undefined),
  };
}

/**
 * Album details with this release as the one shown
 * @param refresh - fetch release group and release from MusicBrainz again (manual refresh)
 * @throws MusicBrainzResponseError for a MusicBrainz error status; network errors throw as they are
 */
export async function loadPinnedRelease(
  releaseId: string,
  { refresh = false }: { refresh?: boolean } = {}
): Promise<Record<string, unknown>> {
  let detailed: RawRelease | undefined;
  let releaseGroupId = releaseStore.get(releaseId)?.releaseGroupId;

  // An unknown release: its lookup names the release group and already brings the tracklist
  if (!releaseGroupId) {
    detailed = await fetchReleaseDetailsOrThrow(releaseId, 'high');
    releaseGroupId = detailed['release-group']?.id;
    if (!releaseGroupId) throw new MusicBrainzResponseError(404, 'Release without a release group');
  }

  if (refresh) {
    await refreshReleaseGroupNow(releaseGroupId);
    forgetCachedImage(`https://coverartarchive.org/release/${releaseId}/front`);
  } else if (releaseGroupCache.isFullyCached(releaseGroupId)) {
    // Stale data is served right away and refreshed in the background
    if (releaseGroupCache.isStale(releaseGroupId)) queueReleaseGroupRefresh(releaseGroupId);
  } else {
    // The prefetch may be loading this album right now: wait for it instead of fetching it a second time
    await releaseGroupFetchInFlight(releaseGroupId);
    if (!releaseGroupCache.isFullyCached(releaseGroupId)) {
      const id = releaseGroupId;
      await withReleaseGroupFetch(id, () => fetchAndStoreReleaseGroup(id, 'high'));
    }
  }

  // The tracklist comes with the release lookup, not with the browse of all releases
  if (refresh || !hasTracklist(releaseStore.get(releaseId))) {
    if (refresh || !detailed) detailed = await fetchReleaseDetailsOrThrow(releaseId, 'high');
    const now = Date.now();
    releaseStore.set(releaseId, {
      ...detailed,
      releaseGroupId,
      _cachedAt: now,
      _expiresAt: releaseGroupCache.get(releaseGroupId)?._expiresAt ?? now,
    });
  }

  return pinnedReleaseData(releaseGroupId, releaseId);
}

/** The cached release group in the shape of /api/release-groups, showing this release */
function pinnedReleaseData(releaseGroupId: string, releaseId: string): Record<string, unknown> {
  const hydrated = releaseGroupCache.getWithReleases(releaseGroupId) as unknown as (Record<string, unknown> & { releases: Release[] }) | undefined;
  const release = releaseStore.get(releaseId) as RawRelease | undefined;
  if (!hydrated || !release) throw new MusicBrainzResponseError(503, 'Service Unavailable');

  const date = release.date || hydrated['first-release-date'] || hydrated.first_release_date || '';
  return {
    ...hydrated,
    id: releaseId,
    releaseGroupId,
    title: release.title || hydrated.title,
    'artist-credit': release['artist-credit'] ?? hydrated['artist-credit'] ?? hydrated.artist_credit,
    'first-release-date': date,
    first_release_date: date,
    // An album with more releases than one browse loads may not list this one
    releases: hydrated.releases.some(other => other.id === releaseId) ? hydrated.releases : [...hydrated.releases, release],
    bestRelease: release,
    releaseDetails: release,
    tracklist: release.media?.flatMap(medium => medium.tracks || []) ?? [],
    selectedReleaseId: releaseId,
    releaseChoice: null,
    pinnedRelease: pinnedReleaseOf(release),
    cover: releaseItemCoverUrl(releaseId, releaseGroupId, release['cover-art-archive']),
  };
}
