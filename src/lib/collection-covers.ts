/**
 * @ai-file lib
 * @ai-description The cover a user chose for a collection or series, kept in the server database
 * @ai-dependencies cache database
 * @ai-features
 * - One release group per collection or series MBID; no entry means automatic (first cached cover)
 * - Shared by every browser and device, so the Collections page shows the same cover everywhere
 */

import { getCacheDatabase } from '@/lib/cache/database';

/** Every chosen cover: collection or series MBID → release group MBID */
export function getCollectionCovers(): Record<string, string> {
  const rows = getCacheDatabase()
    .prepare('SELECT collection_id, release_group_id FROM collection_covers')
    .all() as { collection_id: string; release_group_id: string }[];
  return Object.fromEntries(rows.map(row => [row.collection_id, row.release_group_id]));
}

export function setCollectionCover(collectionId: string, releaseGroupId: string): void {
  getCacheDatabase()
    .prepare(`INSERT INTO collection_covers (collection_id, release_group_id, updated_at) VALUES (?, ?, ?)
              ON CONFLICT (collection_id) DO UPDATE SET release_group_id = excluded.release_group_id, updated_at = excluded.updated_at`)
    .run(collectionId, releaseGroupId, Date.now());
}

/** Back to automatic */
export function clearCollectionCover(collectionId: string): void {
  getCacheDatabase().prepare('DELETE FROM collection_covers WHERE collection_id = ?').run(collectionId);
}
