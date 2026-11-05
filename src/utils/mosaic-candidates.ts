/**
 * @ai-file utility
 * @ai-description Release groups for the cover mosaic of a collection this browser has no copy of
 * @ai-features
 * - Release group collection: the same first page the collection page asks for, so the server's copy
 *   usually answers and a live MusicBrainz request also fills that copy for the next visit
 * - Series collection: its series list (remembered like on its own page) and the first release group series
 * - A dozen candidates per collection, remembered in this browser for a week, so a reload asks for nothing
 */

import { writeCachedSeries, type SeriesSummary } from './collection-info';

const STORAGE_KEY = 'mb-mosaic-candidates';
const MAX_CANDIDATES = 12;
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const RELEASE_GROUP_SERIES = 'Release group series';

interface Remembered {
  fetchedAt: number;
  ids: string[];
}

const readAll = (): Record<string, Remembered> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
};

function remember(id: string, ids: string[]) {
  try {
    const all = readAll();
    const now = Date.now();
    for (const [key, entry] of Object.entries(all)) {
      if (!entry || now - entry.fetchedAt > KEEP_MS) delete all[key];
    }
    all[id] = { fetchedAt: now, ids };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: the mosaic asks again next time
  }
}

function recall(id: string): string[] | null {
  const entry = readAll()[id];
  return entry && Array.isArray(entry.ids) && Date.now() - entry.fetchedAt < KEEP_MS ? entry.ids : null;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MusicBrainz answered ${response.status}`);
  return response.json();
}

/** Cover address of a release group, the same one the grid uses */
export const coverUrlFor = (releaseGroupId: string) => `/api/coverart/release-group/${releaseGroupId}/front`;

/** Release group ids from the collection's first page */
export async function loadCollectionCandidates(collectionId: string): Promise<string[]> {
  const known = recall(collectionId);
  if (known) return known;
  // Same parameters, in the same order, as fetchAllReleaseGroupsInCollection's first page: the server
  // keys its copy by this address
  const params = new URLSearchParams({
    fmt: 'json',
    collection: collectionId,
    inc: 'artist-credits+genres+tags+ratings',
    limit: '100',
    offset: '0',
  });
  const data = await getJson(`/api/musicbrainz/release-group?${params}`);
  const list = Array.isArray(data['release-groups']) ? data['release-groups'] as { id?: unknown }[] : [];
  const ids = list.map(rg => rg.id).filter((id): id is string => typeof id === 'string').slice(0, MAX_CANDIDATES);
  remember(collectionId, ids);
  return ids;
}

/** Release group ids from the first release group series of a series collection */
export async function loadSeriesCollectionCandidates(seriesCollectionId: string): Promise<string[]> {
  const known = recall(seriesCollectionId);
  if (known) return known;
  const data = await getJson(`/api/musicbrainz/series?collection=${seriesCollectionId}&limit=100&offset=0&fmt=json`);
  const series: SeriesSummary[] = (Array.isArray(data.series) ? data.series as SeriesSummary[] : [])
    .map(s => ({ id: s.id, name: s.name, type: s.type, disambiguation: s.disambiguation }));
  const total = typeof data['series-count'] === 'number' ? data['series-count'] : series.length;
  // The whole list fits in one page for most collections: keep it, like the series collection page does
  if (series.length >= total) writeCachedSeries(seriesCollectionId, series);
  const first = series.find(s => s.type === RELEASE_GROUP_SERIES);
  let ids: string[] = [];
  if (first) {
    const detail = await getJson(`/api/musicbrainz/series/${first.id}?fmt=json&inc=release-group-rels`);
    const relations = Array.isArray(detail.relations) ? detail.relations as Record<string, unknown>[] : [];
    ids = relations
      .filter(r => r.type === 'part of' && r['target-type'] === 'release_group')
      .map(r => (r['release-group'] as { id?: unknown } | undefined)?.id)
      .filter((id): id is string => typeof id === 'string')
      .slice(0, MAX_CANDIDATES);
  }
  remember(seriesCollectionId, ids);
  return ids;
}
