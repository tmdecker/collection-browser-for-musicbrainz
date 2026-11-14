/**
 * @ai-file utility
 * @ai-description Pure helpers for choosing releases and extracting tracks
 * @ai-dependencies Release, Media, Track types
 * @ai-features
 * - Shared by the client (utils/api.ts), the release-groups route and the prefetch service
 * - Preferred release: official first, then the most common track count, then oldest date
 * - Best streaming release: Digital Media + Worldwide first
 * - Streaming search order over all releases: Digital Media, then Worldwide, then the rest
 */

import { Media, Release, Track } from '@/types/music';

/**
 * Sort key for a MusicBrainz date: missing parts sort last, so "1959" comes after "1959-08-17"
 * @ai A year-only date says less about the release, so a full date in the same year wins
 */
const dateSortKey = (date?: string): string => {
  if (!date) return '9999-99-99';
  const [year, month = '99', day = '99'] = date.split('-');
  return `${year}-${month}-${day}`;
};

/**
 * Total track count of a release from its media, 0 when unknown
 * @ai The browse API returns "track-count" per medium; the type names it track_count
 */
export const trackCount = (release: Release): number =>
  (release.media ?? []).reduce((sum, medium) => {
    const raw = medium as Media & { 'track-count'?: number };
    return sum + (raw['track-count'] ?? raw.track_count ?? raw.tracks?.length ?? 0);
  }, 0);

/**
 * Select the preferred release from a list of releases
 * @ai Priority: Official status, then the most common track count, then oldest release date
 * @ai The most common track count skips odd editions (partial tapes, bonus tracks, box sets),
 *     so the tracklist matches what most releases of the album contain
 * @returns The preferred release, or null if no releases exist
 */
export const selectPreferredRelease = (releases: Release[]): Release | null => {
  if (!releases || releases.length === 0) return null;

  // Priority 1: Official releases only (if available)
  const officialReleases = releases.filter(r => r.status === 'Official');
  const candidates = officialReleases.length > 0 ? officialReleases : releases;

  // Oldest first; year-only dates after full dates of the same year, undated last
  const byDate = [...candidates].sort((a, b) =>
    dateSortKey(a.date).localeCompare(dateSortKey(b.date))
  );

  // Priority 2: the most common track count; a tie goes to the count of the oldest release
  const frequency = new Map<number, number>();
  for (const release of byDate) {
    const count = trackCount(release);
    if (count > 0) frequency.set(count, (frequency.get(count) ?? 0) + 1);
  }
  let commonCount = 0;
  let commonFrequency = 0;
  for (const [count, times] of frequency) {
    if (times > commonFrequency) {
      commonCount = count;
      commonFrequency = times;
    }
  }

  // Priority 3: oldest release with that track count
  return byDate.find(r => trackCount(r) === commonCount) ?? byDate[0];
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
