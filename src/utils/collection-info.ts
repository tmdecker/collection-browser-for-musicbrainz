/**
 * @ai-file utility
 * @ai-description Browser copies of the signed-in user's collection list and of each collection's entity type and name
 * @ai-features
 * - The Collections page shows the last known list at once and refreshes it in the background
 * - /collection/[mbid] needs the entity type (release group or series collection) before it can render;
 *   it is known from the list, or looked up once and remembered
 */

import { MusicBrainzCollection } from '@/types/auth';

const LIST_KEY = 'mb-user-collections';
const INFO_KEY = 'mb-collection-info';

export interface CollectionInfo {
  entityType: string;  // MusicBrainz entity type, e.g. 'release_group', 'series'
  name: string;
}

interface CachedList {
  username: string;
  fetchedAt: number;
  collections: MusicBrainzCollection[];
}

const read = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app still works, it just loads again next time
  }
};

/** Last known collection list of this user, with when it was fetched */
export function readCachedCollections(username: string): CachedList | null {
  const cached = read<CachedList>(LIST_KEY);
  return cached && cached.username === username && Array.isArray(cached.collections) ? cached : null;
}

/** Remember the list, and each collection's entity type and name */
export function writeCachedCollections(username: string, collections: MusicBrainzCollection[]) {
  write(LIST_KEY, { username, fetchedAt: Date.now(), collections });
  const info = read<Record<string, CollectionInfo>>(INFO_KEY) ?? {};
  for (const c of collections) info[c.id] = { entityType: c['entity-type'], name: c.name };
  write(INFO_KEY, info);
}

export function getCollectionInfo(mbid: string): CollectionInfo | null {
  return read<Record<string, CollectionInfo>>(INFO_KEY)?.[mbid] ?? null;
}

export function rememberCollectionInfo(mbid: string, info: CollectionInfo) {
  const all = read<Record<string, CollectionInfo>>(INFO_KEY) ?? {};
  all[mbid] = info;
  write(INFO_KEY, all);
}

/** Entity type and name of a collection: remembered, or looked up on MusicBrainz (null if that fails) */
export async function loadCollectionInfo(mbid: string): Promise<CollectionInfo | null> {
  const known = getCollectionInfo(mbid);
  if (known) return known;
  try {
    const response = await fetch(`/api/musicbrainz/collection/${mbid}?fmt=json`);
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data?.['entity-type'] !== 'string') return null;
    const info = { entityType: data['entity-type'], name: typeof data.name === 'string' ? data.name : '' };
    rememberCollectionInfo(mbid, info);
    return info;
  } catch {
    return null;
  }
}

/** A series inside a series collection, as MusicBrainz lists it */
export interface SeriesSummary {
  id: string;
  name: string;
  type?: string;            // e.g. 'Release group series', 'Work series'
  disambiguation?: string;
}

interface CachedSeries {
  fetchedAt: number;
  series: SeriesSummary[];
}

const seriesKey = (collectionId: string) => `mb-series-collection-${collectionId}`;

/** Last known series of a series collection */
export function readCachedSeries(collectionId: string): CachedSeries | null {
  const cached = read<CachedSeries>(seriesKey(collectionId));
  return cached && Array.isArray(cached.series) ? cached : null;
}

export function writeCachedSeries(collectionId: string, series: SeriesSummary[]) {
  write(seriesKey(collectionId), { fetchedAt: Date.now(), series });
}
