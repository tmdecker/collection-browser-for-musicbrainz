/**
 * @ai-file utility
 * @ai-description Release items: grid entries that are one fixed release (release collections, release series)
 *   instead of a release group
 * @ai-dependencies music types, release-summary
 * @ai-features
 * - A release item is an album entry whose id is the release MBID, with pinnedRelease and (once known) releaseGroupId
 * - Builds the entry from a MusicBrainz release (collection browse, series relation or lookup)
 * - Release group id, cover address, card line and MusicBrainz address for either kind of entry
 */

import { PinnedRelease, Release, ReleaseGroup } from '@/types/music';
import { releaseFormat } from './release-summary';

export const isReleaseItem = (album: Pick<ReleaseGroup, 'pinnedRelease'> | null | undefined): boolean =>
  !!album?.pinnedRelease;

/** The release group an entry belongs to: its own id, or a release item's group (undefined until known) */
export const releaseGroupIdOf = (
  album: Pick<ReleaseGroup, 'id' | 'pinnedRelease' | 'releaseGroupId'> | null | undefined
): string | undefined => (album ? (album.pinnedRelease ? album.releaseGroupId : album.id) : undefined);

export const releaseGroupCoverUrl = (releaseGroupId: string): string => `/api/coverart/release-group/${releaseGroupId}/front`;
export const releaseCoverUrl = (releaseId: string): string => `/api/coverart/release/${releaseId}/front`;

/**
 * Cover of a release item: its own front cover, or the release group's when Cover Art Archive
 * has none for this release (unknown counts as "has one")
 */
export const releaseItemCoverUrl = (
  releaseId: string,
  releaseGroupId: string | undefined,
  coverArt: Release['cover-art-archive'] | undefined
): string => (coverArt?.front === false && releaseGroupId ? releaseGroupCoverUrl(releaseGroupId) : releaseCoverUrl(releaseId));

/** Date, country and format of a release; the format only when its media are known */
export const pinnedReleaseOf = (release: Pick<Release, 'date' | 'country' | 'media'>): PinnedRelease => ({
  date: release.date || undefined,
  country: release.country || undefined,
  format: release.media?.length ? releaseFormat(release as Release) : undefined,
});

/**
 * Grid entry for a release as MusicBrainz returns it (hyphenated keys). The release group comes along
 * in a collection browse (inc=release-groups), not in a series relation
 */
export const releaseToItem = (release: any): any => {
  const releaseGroup = release['release-group'] ?? {};
  const item: Record<string, unknown> = {
    id: release.id,
    title: release.title,
    disambiguation: release.disambiguation ?? '',
    'artist-credit': release['artist-credit'] ?? releaseGroup['artist-credit'] ?? [],
    // The release's own date: this pressing is what was collected
    'first-release-date': release.date || releaseGroup['first-release-date'] || '',
    'primary-type': releaseGroup['primary-type'] ?? '',
    'secondary-types': releaseGroup['secondary-types'] ?? [],
    releaseGroupId: releaseGroup.id,
    pinnedRelease: pinnedReleaseOf(release),
    cover: releaseItemCoverUrl(release.id, releaseGroup.id, release['cover-art-archive']),
  };
  // Genres, tags and ratings belong to the release group
  for (const key of ['genres', 'tags', 'rating', 'user-rating']) {
    if (releaseGroup[key] !== undefined) item[key] = releaseGroup[key];
  }
  // Labels (label filter) and the date under the tracklist are known before the details load
  if (release['label-info']) item.releaseDetails = release;
  return item;
};

/** Third line of a grid card: the year, for a release item with its format ("CD · 1997") */
export const cardFactLine = (album: Pick<ReleaseGroup, 'first_release_date' | 'pinnedRelease'>): string => {
  const year = album.first_release_date ? album.first_release_date.split('-')[0] : '';
  return [album.pinnedRelease?.format, year].filter(Boolean).join(' · ');
};

/** The entry's page on musicbrainz.org */
export const musicBrainzUrlOf = (album: Pick<ReleaseGroup, 'id' | 'pinnedRelease'>): string =>
  `https://musicbrainz.org/${album.pinnedRelease ? 'release' : 'release-group'}/${album.id}`;
