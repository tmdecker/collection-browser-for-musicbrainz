/**
 * @ai-file utility
 * @ai-description Loads all releases of a release group from MusicBrainz, page by page
 * @ai-dependencies Release type
 * @ai-features
 * - MusicBrainz browse returns at most 100 releases per request; big albums have several hundred
 * - Includes url-rels, so streaming links of every release arrive without one lookup per release
 * - Caller supplies the fetch (rate limiting and priority stay with the caller)
 * - Capped at MAX_RELEASE_PAGES so one album cannot use up the rate limit for minutes
 */

import { Release } from '@/types/music';

const MB_BASE_URL = 'https://musicbrainz.org/ws/2';
const PAGE_SIZE = 100;
// 5 pages = 500 releases, more than nearly any album has
export const MAX_RELEASE_PAGES = 5;

export class ReleaseBrowseError extends Error {
  constructor(readonly status: number, statusText: string) {
    super(`Failed to fetch releases: ${statusText || status}`);
  }
}

/**
 * Browse all releases of a release group
 * @param fetchPage - Performs one MusicBrainz request (with the caller's rate limiting and headers)
 * @throws ReleaseBrowseError when the first page fails; later page failures keep what was loaded
 */
export const browseAllReleases = async (
  releaseGroupMbid: string,
  fetchPage: (url: string) => Promise<Response>
): Promise<Release[]> => {
  const releases: Release[] = [];
  let total = Infinity;

  for (let page = 0; page < MAX_RELEASE_PAGES && releases.length < total; page++) {
    const url = `${MB_BASE_URL}/release?fmt=json&release-group=${releaseGroupMbid}&inc=media+url-rels&limit=${PAGE_SIZE}&offset=${releases.length}`;
    const response = await fetchPage(url);

    if (!response.ok) {
      if (page === 0) throw new ReleaseBrowseError(response.status, response.statusText);
      console.warn(`⚠️ Release page ${page + 1} for ${releaseGroupMbid} failed (${response.status}), keeping ${releases.length} releases`);
      break;
    }

    const data: { releases?: Release[]; 'release-count'?: number } = await response.json();
    const batch = data.releases || [];
    releases.push(...batch);
    total = data['release-count'] ?? releases.length;
    if (batch.length < PAGE_SIZE) break;
  }

  if (releases.length < total) {
    console.warn(`⚠️ Release group ${releaseGroupMbid} has ${total} releases, loaded the first ${releases.length}`);
  }
  return releases;
};
