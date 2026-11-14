/**
 * @ai-file lib
 * @ai-description The release the user picked for an album (release group), kept in the server database
 * @ai-dependencies database
 * @ai-features
 * - One row per release group in release_choices; cache refreshes never clear it
 * - Shared by every browser and every user of this server
 */

import { getCacheDatabase } from './cache/database';

/** The chosen release of a release group, or null when the app picks one itself */
export const getReleaseChoice = (releaseGroupId: string): string | null => {
  const row = getCacheDatabase()
    .prepare('SELECT release_id FROM release_choices WHERE release_group_id = ?')
    .get(releaseGroupId) as { release_id: string } | undefined;
  return row?.release_id ?? null;
};

export const setReleaseChoice = (releaseGroupId: string, releaseId: string): void => {
  getCacheDatabase()
    .prepare(
      `INSERT INTO release_choices (release_group_id, release_id, chosen_at) VALUES (?, ?, ?)
       ON CONFLICT (release_group_id) DO UPDATE SET release_id = excluded.release_id, chosen_at = excluded.chosen_at`
    )
    .run(releaseGroupId, releaseId, Date.now());
};

export const clearReleaseChoice = (releaseGroupId: string): void => {
  getCacheDatabase().prepare('DELETE FROM release_choices WHERE release_group_id = ?').run(releaseGroupId);
};
