/**
 * @ai-file utility
 * @ai-description Recently opened collections and series, kept in this browser (localStorage)
 * @ai-features
 * - Newest first, at most 8 entries, one per address
 * - Each entry knows its kind (release group collection, series collection, series) and,
 *   for a series opened from a series collection, that collection's id (for its link and breadcrumb)
 */

import { collectionPath, type CollectionEntityType } from './collection-routes';

const STORAGE_KEY = 'mb-recently-opened';
const MAX_ENTRIES = 8;

export type RecentKind = 'release_group_collection' | 'series_collection' | 'series';

export interface RecentEntry {
  entityType: CollectionEntityType;
  mbid: string;
  name: string;
  kind: RecentKind;
  /** Series collection a series was opened from */
  parentCollectionId?: string;
  openedAt: number;
}

export function readRecentlyOpened(): RecentEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(e => e && typeof e.mbid === 'string' && typeof e.name === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberRecentlyOpened(entry: Omit<RecentEntry, 'openedAt'>) {
  if (!entry.mbid || !entry.name) return;
  try {
    const rest = readRecentlyOpened().filter(e => !(e.mbid === entry.mbid && e.entityType === entry.entityType));
    const next = [{ ...entry, openedAt: Date.now() }, ...rest].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the list is a convenience, nothing breaks without it
  }
}

/** Address of an entry, with the parent series collection for a series opened from one */
export function recentHref(entry: RecentEntry): string {
  const path = collectionPath(entry.entityType, entry.mbid);
  return entry.parentCollectionId ? `${path}?collection=${entry.parentCollectionId}` : path;
}

export const recentKindLabel: Record<RecentKind, string> = {
  release_group_collection: 'Release group collection',
  series_collection: 'Series collection',
  series: 'Series',
};
