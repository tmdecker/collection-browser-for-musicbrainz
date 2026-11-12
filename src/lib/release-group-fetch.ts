/**
 * @ai-file lib
 * @ai-description Loads a release group with all its releases from MusicBrainz and stores it in the server caches
 * @ai-dependencies musicbrainz-fetch, browse-releases, release-group-cache, release-store, release-selection
 * @ai-features
 * - Used by clicks (/api/release-groups, 'high' priority) and the prefetch ('low'), so both store the same data
 * - Release group (genres, tags, ratings), every release with url-rels, and the preferred release with its
 *   tracklist and labels
 * - The preferred release's details are optional: without them the album is still stored (no tracklist)
 * - MusicBrainz errors (still 503 after the retries, 404, ...) throw MusicBrainzResponseError with the status
 */

import { Release, Track } from '@/types/music';
import { ALBUM_DATA_TTL_SECONDS, releaseGroupCache } from './cache/release-group-cache';
import { releaseStore } from './cache/release-store';
import { browseAllReleases, ReleaseBrowseError } from './browse-releases';
import { MB_BASE_URL, musicBrainzFetch } from './musicbrainz-fetch';
import { RateLimitPriority } from './rate-limiter';
import { extractTracksFromMedia, selectPreferredRelease } from '@/utils/release-selection';

/** MusicBrainz answered with an error status (after the retries for 503) */
export class MusicBrainzResponseError extends Error {
  constructor(readonly status: number, statusText: string) {
    super(status === 503
      ? 'MusicBrainz is busy, please try again in a moment'
      : `MusicBrainz API error: ${statusText || status}`);
  }
}

export interface FetchedReleaseGroup {
  /** The release group as MusicBrainz returns it */
  releaseGroup: Record<string, unknown>;
  releases: Release[];
  /** Oldest official release (see selectPreferredRelease); null when the group has no releases */
  preferredRelease: Release | null;
  /** The preferred release with recordings and labels, when that lookup worked */
  detailedRelease?: Release;
  tracklist: Track[];
}

export const coverUrlFor = (mbid: string): string => `/api/coverart/release-group/${mbid}/front`;

/**
 * Fetch a release group from MusicBrainz and store it (release group, every release, detailed release)
 */
export async function fetchAndStoreReleaseGroup(mbid: string, priority: RateLimitPriority): Promise<FetchedReleaseGroup> {
  // Step 1: release group (genres, tags, ratings)
  const rgResponse = await musicBrainzFetch(
    `${MB_BASE_URL}/release-group/${mbid}?fmt=json&inc=artist-credits+genres+tags+ratings`,
    { priority }
  );
  if (!rgResponse.ok) {
    await rgResponse.body?.cancel();
    throw new MusicBrainzResponseError(rgResponse.status, rgResponse.statusText);
  }
  const releaseGroup = await rgResponse.json();

  // Step 2: every release (browse returns 100 per page), with url-rels for the streaming links
  let releases: Release[];
  try {
    releases = await browseAllReleases(mbid, url => musicBrainzFetch(url, { priority }));
  } catch (error) {
    if (error instanceof ReleaseBrowseError) throw new MusicBrainzResponseError(error.status, error.message);
    throw error;
  }

  const now = Date.now();
  const expiresAt = now + ALBUM_DATA_TTL_SECONDS * 1000;
  const preferredRelease = selectPreferredRelease(releases);

  if (!preferredRelease) {
    console.warn(`❌ No releases found for release group ${mbid}`);
    releaseGroupCache.set(mbid, {
      ...releaseGroup,
      releaseMbids: [],
      cover: coverUrlFor(mbid),
      _cachedAt: now,
      _expiresAt: expiresAt,
    });
    return { releaseGroup, releases: [], preferredRelease: null, tracklist: [] };
  }

  // Step 3: the preferred release with tracks and labels (optional: the album is stored without it)
  let detailedRelease: Release | undefined;
  try {
    const response = await musicBrainzFetch(
      `${MB_BASE_URL}/release/${preferredRelease.id}?fmt=json&inc=recordings+labels+artist-credits+url-rels`,
      { priority }
    );
    if (response.ok) {
      detailedRelease = await response.json();
    } else {
      await response.body?.cancel();
      console.warn(`❌ Release details for ${preferredRelease.id} failed: ${response.status}`);
    }
  } catch (error) {
    console.warn(`❌ Failed to fetch release details for ${preferredRelease.id}:`, error);
  }
  const tracklist = extractTracksFromMedia(detailedRelease?.media || []);

  // Step 4: store everything
  for (const release of releases) {
    releaseStore.set(release.id, { ...release, releaseGroupId: mbid, _cachedAt: now, _expiresAt: expiresAt });
  }
  if (detailedRelease) {
    releaseStore.set(detailedRelease.id, { ...detailedRelease, releaseGroupId: mbid, _cachedAt: now, _expiresAt: expiresAt });
  }
  releaseGroupCache.set(mbid, {
    ...releaseGroup,
    releaseMbids: releases.map(release => release.id),
    bestReleaseMbid: preferredRelease.id,
    cover: coverUrlFor(mbid),
    _cachedAt: now,
    _expiresAt: expiresAt,
  });
  console.log(`✅ Cached release group ${mbid} with ${releases.length} releases and ${tracklist.length} tracks`);

  return { releaseGroup, releases, preferredRelease, detailedRelease, tracklist };
}
