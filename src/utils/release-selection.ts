/**
 * @ai-file utility
 * @ai-description Pure helpers for choosing releases and extracting tracks
 * @ai-dependencies Release, Media, Track types
 * @ai-features
 * - Shared by the client (utils/api.ts), the release-groups route and the prefetch service
 * - Preferred release: official first, then oldest date
 * - Best streaming release: Digital Media + Worldwide first
 * - Streaming search order over all releases: Digital Media, then Worldwide, then the rest
 */

import { Media, Release, Track } from '@/types/music';

/**
 * Select the preferred release from a list of releases
 * @ai Priority: Official status first, then oldest release date
 * @ai Ensures album details (tracks, labels) come from original official release
 * @returns The preferred release, or null if no releases exist
 */
export const selectPreferredRelease = (releases: Release[]): Release | null => {
  if (!releases || releases.length === 0) return null;

  // Priority 1: Official releases only (if available)
  const officialReleases = releases.filter(r => r.status === 'Official');
  const candidates = officialReleases.length > 0 ? officialReleases : releases;

  // Priority 2: Sort by date (oldest first = original release)
  const sorted = [...candidates].sort((a, b) => {
    const dateA = a.date || '9999-99-99';
    const dateB = b.date || '9999-99-99';
    return dateA.localeCompare(dateB);
  });

  return sorted[0];
};

/**
 * Convert MusicBrainz media tracks to a flat track list
 */
export const extractTracksFromMedia = (media: Media[]): Track[] => {
  if (!media || media.length === 0) return [];

  const tracks: Track[] = [];
  media.forEach(medium => {
    if (medium.tracks) {
      tracks.push(...medium.tracks);
    }
  });

  return tracks;
};

/**
 * Find the best release for streaming links
 * @ai Priority: Digital Media + XW > Digital Media > XW, null if none match
 * @ai Enables finding streaming URLs on modern digital releases
 */
export const findBestStreamingRelease = (releases: Release[]): Release | null => {
  if (!releases || releases.length === 0) return null;

  // Priority 1: Digital Media + Worldwide
  const digitalXW = releases.find(r =>
    r.media?.some(m => m.format === 'Digital Media') && r.country === 'XW'
  );
  if (digitalXW) return digitalXW;

  // Priority 2: Any Digital Media
  const digital = releases.find(r =>
    r.media?.some(m => m.format === 'Digital Media')
  );
  if (digital) return digital;

  // Priority 3: Any XW release
  const xw = releases.find(r => r.country === 'XW');
  if (xw) return xw;

  return null;
};

/**
 * Order releases for the streaming link search
 * @ai Digital Media first, then Worldwide (XW), then the rest; newest first within each group, undated last
 */
export const orderReleasesForStreaming = (releases: Release[]): Release[] => {
  const rank = (release: Release) => {
    if (release.media?.some(m => m.format === 'Digital Media')) return 0;
    if (release.country === 'XW') return 1;
    return 2;
  };

  return [...releases].sort((a, b) =>
    rank(a) - rank(b) || (b.date || '').localeCompare(a.date || '')
  );
};
