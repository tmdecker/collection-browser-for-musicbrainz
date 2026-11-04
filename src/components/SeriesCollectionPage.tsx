/**
 * @ai-file component
 * @ai-description A series collection: the series in it, each opening its release group grid
 * @ai-dependencies React, Next.js Link, AppMenu, usePreferences, collection-info
 * @ai-features
 * - Breadcrumb "Collections / name", series count and a MusicBrainz link, like the collection header
 * - Release group series open at /series/<mbid>?collection=<mbid> (for the breadcrumb back);
 *   other series types (work, event, …) are listed but can't be opened yet
 * - Shows the last known list at once and refreshes it in the background
 * - Remembered as the last opened collection, so / comes back here
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BiLoaderAlt } from 'react-icons/bi';
import { SiMusicbrainz } from 'react-icons/si';
import CollectionFootnote from './CollectionFootnote';
import AppMenu from './AppMenu';
import { usePreferences } from '@/hooks/usePreferences';
import { collectionPath } from '@/utils/collection-routes';
import { readCachedSeries, writeCachedSeries, SeriesSummary } from '@/utils/collection-info';
import { rememberRecentlyOpened } from '@/utils/recently-opened';

const PAGE_SIZE = 100;
const RELEASE_GROUP_SERIES = 'Release group series';

async function fetchAllSeries(collectionId: string): Promise<SeriesSummary[]> {
  const all: SeriesSummary[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetch(`/api/musicbrainz/series?collection=${collectionId}&limit=${PAGE_SIZE}&offset=${offset}&fmt=json`);
    if (!response.ok) throw new Error(`MusicBrainz answered ${response.status}`);
    const data = await response.json();
    const page: SeriesSummary[] = (data.series ?? []).map((s: SeriesSummary) => ({
      id: s.id, name: s.name, type: s.type, disambiguation: s.disambiguation,
    }));
    all.push(...page);
    const total = typeof data['series-count'] === 'number' ? data['series-count'] : all.length;
    if (page.length === 0 || all.length >= total) return all;
  }
}

export default function SeriesCollectionPage({ mbid, name }: { mbid: string; name: string }) {
  const { isInitialized, updateApi, updateMetadata } = usePreferences();
  const [series, setSeries] = useState<SeriesSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Remember this collection as the last one opened (once per collection)
  const syncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isInitialized || syncedRef.current === mbid) return;
    syncedRef.current = mbid;
    updateApi({ collectionId: mbid });
    updateMetadata({ entityType: 'collection', collectionName: name });
  }, [isInitialized, mbid, name, updateApi, updateMetadata]);

  // Recently opened list on the Collections page
  useEffect(() => {
    if (name) rememberRecentlyOpened({ entityType: 'collection', mbid, name, kind: 'series_collection' });
  }, [mbid, name]);

  // Show the last known list at once and refresh it in the background
  useEffect(() => {
    let cancelled = false;
    const cached = readCachedSeries(mbid);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeries(cached?.series ?? null);
    setLoadError(null);
    if (cached && Date.now() - cached.fetchedAt < 60_000) return;
    fetchAllSeries(mbid)
      .then(list => {
        writeCachedSeries(mbid, list);
        if (!cancelled) setSeries(list);
      })
      .catch(err => {
        if (!cancelled && !cached) setLoadError(err instanceof Error ? err.message : 'Unknown error');
      });
    return () => { cancelled = true; };
  }, [mbid]);

  const sorted = series ? [...series].sort((a, b) => a.name.localeCompare(b.name)) : null;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-30 bg-background">
        <header className="relative p-3 md:px-8 md:pt-4 md:pb-4 header-surface">
          <div className="flex items-center gap-2 min-h-[40px] md:min-h-[42px] min-w-0">
            <AppMenu />
            <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 min-w-0 ml-1 text-[15px]">
              <Link href="/collections" className="text-text-secondary hover:text-white transition-colors flex-shrink-0">
                Collections
              </Link>
              <span className="text-white/30 flex-shrink-0" aria-hidden="true">/</span>
              <span className="min-w-0 truncate font-semibold text-white" aria-current="page">{name || 'Series collection'}</span>
            </nav>
          </div>
        </header>
      </div>

      <div className="flex-1 w-full flex flex-col">
      <div className="max-w-3xl px-3 md:px-8 pt-4 md:pt-8 pb-2">
        {loadError ? (
          <p className="text-red-400 text-sm">Couldn&apos;t load the series in this collection: {loadError}</p>
        ) : !sorted ? (
          <div className="flex items-center gap-3 text-text-secondary py-6">
            <BiLoaderAlt className="w-5 h-5 animate-spin" /> Loading series…
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-text-secondary text-sm">This collection has no series yet.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map(s => {
              const supported = s.type === RELEASE_GROUP_SERIES;
              const label = (
                <>
                  <span className={`font-medium truncate ${supported ? 'text-text-primary' : 'text-text-tertiary'}`}>{s.name}</span>
                  {s.disambiguation && <span className="text-xs text-text-tertiary truncate">{s.disambiguation}</span>}
                  {!supported && (
                    <span className="ml-auto text-xs text-text-tertiary/70 whitespace-nowrap">
                      {s.type ? `${s.type} · ` : ''}not supported yet
                    </span>
                  )}
                </>
              );
              return (
                <div key={s.id} className="group flex items-center gap-3 rounded-xl bg-background-secondary hover:bg-background-tertiary transition-colors pr-4">
                  {supported ? (
                    <Link href={`${collectionPath('series', s.id)}?collection=${mbid}`} className="flex-1 min-w-0 flex items-center gap-3 py-3 pl-4">
                      {label}
                    </Link>
                  ) : (
                    <div className="flex-1 min-w-0 flex items-center gap-3 py-3 pl-4 cursor-default">{label}</div>
                  )}
                  <a
                    href={`https://musicbrainz.org/series/${s.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-text-secondary hover:text-white transition-colors duration-200 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
                    title="Open on MusicBrainz"
                    aria-label={`Open ${s.name} on MusicBrainz`}
                  >
                    <SiMusicbrainz size={16} />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <CollectionFootnote
        name={name || 'Series collection'}
        count={series ? `${series.length.toLocaleString()} series` : null}
        musicBrainzUrl={`https://musicbrainz.org/collection/${mbid}`}
      />
      </div>
    </main>
  );
}
