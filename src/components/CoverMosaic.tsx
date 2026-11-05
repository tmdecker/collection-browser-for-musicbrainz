/**
 * @ai-file component
 * @ai-description 2x2 cover mosaic for a collection or series, from release groups cached in this browser
 *   or, when this browser has none, from a few background requests that are remembered afterwards
 * @ai-dependencies React, CoverArtImage, IndexedDB cache (utils/db), mosaic-candidates
 * @ai-features
 * - Reads the collection's cached release group list first (no MusicBrainz requests); picks the first four with a cover
 * - Series collections: one cover from each series opened in this browser, filled up with more from the same series
 * - Nothing cached in this browser: asks for the collection's first page (the server usually has a copy) or,
 *   for a series collection, its series list and the first release group series, then fills in by itself
 * - A cover that fails to load is replaced by the next candidate, so only about four images are requested
 * - Same cover URLs and size as the grid, so the browser usually has them already
 * - Plain tiles (with an optional icon) while nothing is known yet
 */

import React, { useCallback, useEffect, useState } from 'react';
import CoverArtImage from './CoverArtImage';
import { getCollectionMetadata, getReleaseGroup } from '@/utils/db';
import { loadCollectionCandidates, loadSeriesCandidates, loadSeriesCollectionCandidates, coverUrlFor } from '@/utils/mosaic-candidates';

interface CoverMosaicProps {
  /** Collection or series MBID whose cached release groups to show; nothing for a series collection */
  collectionId?: string;
  /** Series of a series collection: one cover from each, instead of collectionId */
  seriesIds?: string[];
  /** What collectionId is, to look it up when this browser has no covers for it: a release group
   *  collection (its first page) or a release group series (its lookup); nothing looks nothing up */
  fetchMissing?: 'collection' | 'series';
  /** Series collection MBID: used to look its series up when this browser has no covers for it */
  seriesCollectionId?: string;
  className?: string;
  /** Shown in the empty mosaic */
  emptyIcon?: React.ReactNode;
}

const SLOTS = 4;

// Cover candidates per id, shared by every mosaic on the page and kept for the session
const coverCache = new Map<string, string[]>();
const pending = new Map<string, Promise<string[]>>();

// Shared, so several mosaics of the same collection (tile and recent row) make one set of requests
function once(key: string, load: () => Promise<string[]>): Promise<string[]> {
  const cached = coverCache.get(key);
  if (cached) return Promise.resolve(cached);
  const running = pending.get(key);
  if (running) return running;
  const promise = load()
    .catch(() => [] as string[])
    .then(list => { coverCache.set(key, list); pending.delete(key); return list; });
  pending.set(key, promise);
  return promise;
}

// Covers of release groups this browser has cached for the collection or series
async function loadBrowserCovers(collectionId: string): Promise<string[]> {
  const covers: string[] = [];
  try {
    const metadata = await getCollectionMetadata(collectionId);
    for (const id of metadata?.albumIds.slice(0, 24) ?? []) {
      const rg = await getReleaseGroup(id, { includeExpired: true });
      if (rg?.cover && rg.cover !== '/placeholder.svg') covers.push(rg.cover);
      if (covers.length === SLOTS) break;
    }
  } catch {
    // No cache available (private window, blocked storage)
  }
  return covers;
}

const loadCovers = (collectionId: string, fetchMissing?: 'collection' | 'series') =>
  once(fetchMissing ? collectionId : `local:${collectionId}`, async () => {
    const local = await loadBrowserCovers(collectionId);
    if (local.length > 0 || !fetchMissing) return local;
    const ids = fetchMissing === 'series'
      ? await loadSeriesCandidates(collectionId)
      : await loadCollectionCandidates(collectionId);
    return ids.map(coverUrlFor);
  });

// One cover from each series first; with fewer than four series, more covers of the same series fill the rest
async function interleave(seriesIds: string[]): Promise<string[]> {
  const perSeries: string[][] = [];
  for (const id of seriesIds.slice(0, 16)) {
    const list = await loadCovers(id);
    if (list.length > 0) perSeries.push(list);
    if (perSeries.length === SLOTS) break;
  }
  const covers: string[] = [];
  for (let round = 0; round < SLOTS && covers.length < SLOTS; round++) {
    for (const list of perSeries) {
      const cover = list[round];
      if (cover && !covers.includes(cover)) covers.push(cover);
      if (covers.length === SLOTS) break;
    }
  }
  return covers;
}

const loadSeriesCovers = (seriesIds: string[], seriesCollectionId?: string) =>
  once(`series:${seriesCollectionId ?? ''}:${seriesIds.join(',')}`, async () => {
    const local = seriesIds.length > 0 ? await interleave(seriesIds) : [];
    if (local.length > 0 || !seriesCollectionId) return local;
    return (await loadSeriesCollectionCandidates(seriesCollectionId)).map(coverUrlFor);
  });

export interface MosaicSource {
  collectionId?: string;
  seriesIds?: string[];
  fetchMissing?: 'collection' | 'series';
  seriesCollectionId?: string;
}

/** The first covers of a collection, series or series collection, and a way to drop one whose image failed */
export function useMosaicCovers({ collectionId, fetchMissing, seriesIds, seriesCollectionId }: MosaicSource) {
  const seriesKey = seriesIds?.join(',') ?? '';
  const isSeries = !!seriesKey || !!seriesCollectionId;
  const cacheKey = isSeries
    ? `series:${seriesCollectionId ?? ''}:${seriesKey}`
    : collectionId && (fetchMissing ? collectionId : `local:${collectionId}`);
  const [covers, setCovers] = useState<string[]>(() => (cacheKey && coverCache.get(cacheKey)) || []);
  // Candidates whose image failed to load; the next ones move up into the free slots
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!isSeries && !collectionId) return;
    let cancelled = false;
    const load = isSeries
      ? loadSeriesCovers(seriesKey ? seriesKey.split(',') : [], seriesCollectionId)
      : loadCovers(collectionId!, fetchMissing);
    load.then(list => { if (!cancelled) setCovers(list); });
    return () => { cancelled = true; };
  }, [collectionId, fetchMissing, seriesKey, seriesCollectionId, isSeries]);

  const shown = covers.filter(c => !failed.has(c)).slice(0, SLOTS);
  const markFailed = useCallback((cover: string) => setFailed(prev => new Set(prev).add(cover)), []);
  return { shown, markFailed };
}

export default function CoverMosaic({ collectionId, fetchMissing, seriesIds, seriesCollectionId, className = '', emptyIcon }: CoverMosaicProps) {
  const { shown, markFailed } = useMosaicCovers({ collectionId, fetchMissing, seriesIds, seriesCollectionId });

  if (shown.length === 0) {
    return (
      <div className={`grid place-items-center bg-background-tertiary text-text-tertiary overflow-hidden ${className}`} aria-hidden="true">
        {emptyIcon}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-px bg-background overflow-hidden ${className}`} aria-hidden="true">
      {Array.from({ length: SLOTS }, (_, i) => (
        <div key={shown[i] ?? `empty-${i}`} className="relative bg-background-tertiary">
          {shown[i] && (
            <CoverArtImage
              src={shown[i]}
              alt=""
              className="object-cover"
              onError={() => markFailed(shown[i])}
            />
          )}
        </div>
      ))}
    </div>
  );
}
