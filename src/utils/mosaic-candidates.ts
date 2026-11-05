/**
 * @ai-file utility
 * @ai-description Release groups for the cover mosaic of a collection this browser has no copy of
 * @ai-features
 * - Release group collection: the same first page the collection page asks for, so the server's copy
 *   usually answers and a live MusicBrainz request also fills that copy for the next visit
 * - Series: one series lookup, which also gives its release group count; series collection: its series
 *   list (remembered like on its own page) and the lookup of its first release group series
 * - Series lookups run one at a time, so a page full of series never queues up ahead of a click
 * - A dozen candidates per collection, remembered in this browser for a week, so a reload asks for nothing
 */

import { writeCachedSeries, type SeriesSummary } from './collection-info';

// v2: v1 could hold empty lists for series from a bug, which would have kept those mosaics empty for a week
const STORAGE_KEY = 'mb-mosaic-candidates-v2';
const MAX_CANDIDATES = 12;
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const RELEASE_GROUP_SERIES = 'Release group series';

interface Remembered {
  fetchedAt: number;
  ids: string[];
  count?: number;   // release groups in a series
}

/** A release group series as far as its tile needs it */
export interface SeriesContents {
  ids: string[];    // the first release groups, for the mosaic
  count: number;    // all release groups in the series
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

function remember(id: string, ids: string[], count?: number) {
  // Nothing found is not remembered, so a collection that gets its first release group shows it next time
  if (ids.length === 0) return;
  try {
    const all = readAll();
    const now = Date.now();
    for (const [key, entry] of Object.entries(all)) {
      if (!entry || now - entry.fetchedAt > KEEP_MS) delete all[key];
    }
    all[id] = count === undefined ? { fetchedAt: now, ids } : { fetchedAt: now, ids, count };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: the mosaic asks again next time
  }
}

function recallEntry(id: string): Remembered | null {
  const entry = readAll()[id];
  return entry && Array.isArray(entry.ids) && Date.now() - entry.fetchedAt < KEEP_MS ? entry : null;
}

const recall = (id: string): string[] | null => recallEntry(id)?.ids ?? null;

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

async function lookupSeries(seriesId: string): Promise<SeriesContents> {
  const detail = await getJson(`/api/musicbrainz/series/${seriesId}?fmt=json&inc=release-group-rels`);
  const relations = Array.isArray(detail.relations) ? detail.relations as Record<string, unknown>[] : [];
  const all = relations
    .filter(r => r.type === 'part of' && r['target-type'] === 'release_group')
    // MusicBrainz names the related entity after its type: release_group
    .map(r => ((r.release_group ?? r['release-group']) as { id?: unknown } | undefined)?.id)
    .filter((id): id is string => typeof id === 'string');
  const contents = { ids: all.slice(0, MAX_CANDIDATES), count: new Set(all).size };
  remember(seriesId, contents.ids, contents.count);
  return contents;
}

// One series lookup at a time; the same series asked for twice (tile text and mosaic) shares one request
let lookupChain: Promise<unknown> = Promise.resolve();
const lookups = new Map<string, Promise<SeriesContents>>();

/** First release group ids and release group count of a release group series (one lookup, like opening it) */
export function loadSeriesContents(seriesId: string): Promise<SeriesContents> {
  const known = recallEntry(seriesId);
  if (known && known.count !== undefined) return Promise.resolve({ ids: known.ids, count: known.count });
  const running = lookups.get(seriesId);
  if (running) return running;
  const promise = lookupChain.then(() => lookupSeries(seriesId));
  const done = () => { lookups.delete(seriesId); };
  lookupChain = promise.then(done, done);
  lookups.set(seriesId, promise);
  return promise;
}

/** Release group ids of a release group series */
export const loadSeriesCandidates = async (seriesId: string): Promise<string[]> =>
  (await loadSeriesContents(seriesId)).ids;

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
  const ids = first ? await loadSeriesCandidates(first.id) : [];
  remember(seriesCollectionId, ids);
  return ids;
}
