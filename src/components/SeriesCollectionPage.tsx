/**
 * @ai-file component
 * @ai-description A series collection: the series in it, each opening its release group grid
 * @ai-dependencies React, Next.js Link, AppMenu, usePreferences, collection-info
 * @ai-features
 * - Same header as the Collections page: breadcrumb, series name search, grid/list switch, account button
 * - Each release group series as a cover mosaic card or a compact row (covers and counts from series opened
 *   in this browser); other series types (work, event, …) as plain rows under "Other series"
 * - Release group series open at /series/<mbid>?collection=<mbid> (for the breadcrumb back)
 * - Shows the last known list at once and refreshes it in the background
 * - Remembered as the last opened collection, so / comes back here
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BiLoaderAlt } from 'react-icons/bi';
import CollectionFootnote from './CollectionFootnote';
import AppMenu from './AppMenu';
import SearchBar from './SearchBar';
import UserAvatarButton from './UserAvatarButton';
import { SectionHeading, Tile, UnsupportedRow, ViewSwitch, foldText, rowListClass, tileGridClass, useTileView } from './CollectionTiles';
import { getCollectionMetadata } from '@/utils/db';
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

  // Release group counts of series opened in this browser (from the cache, no MusicBrainz requests)
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!series) return;
    let cancelled = false;
    Promise.all(series.filter(s => s.type === RELEASE_GROUP_SERIES).map(async s => {
      try {
        const metadata = await getCollectionMetadata(s.id);
        return metadata ? [s.id, metadata.albumIds.length] as const : null;
      } catch {
        return null;
      }
    })).then(entries => {
      if (cancelled) return;
      setCounts(Object.fromEntries(entries.filter((e): e is readonly [string, number] => e !== null)));
    });
    return () => { cancelled = true; };
  }, [series]);

  const [view, chooseView] = useTileView();
  const [query, setQuery] = useState('');
  const needle = foldText(query.trim());
  const sorted = series
    ? [...series].filter(s => !needle || foldText(s.name).includes(needle)).sort((a, b) => a.name.localeCompare(b.name))
    : null;
  const openable = sorted?.filter(s => s.type === RELEASE_GROUP_SERIES) ?? [];
  const other = sorted?.filter(s => s.type !== RELEASE_GROUP_SERIES) ?? [];
  const showControls = !!series && series.length > 0;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-30 bg-background">
        <header className="relative p-3 md:px-8 md:pt-4 md:pb-4 header-surface">
          {/* Same layout as the other pages: menu and breadcrumb left; search, view switch and account right */}
          <div className="flex items-center gap-2 md:gap-3 min-h-[40px] md:min-h-[42px]">
            <div className="flex items-center min-w-0 flex-shrink-0 md:flex-1">
              <AppMenu />
              <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 min-w-0 ml-3 text-[15px]">
                <Link href="/collections" className="text-text-secondary hover:text-white transition-colors flex-shrink-0">
                  Collections
                </Link>
                <span className="text-white/30 flex-shrink-0" aria-hidden="true">/</span>
                <span className="min-w-0 truncate font-semibold text-white" aria-current="page">{name || 'Series collection'}</span>
              </nav>
            </div>
            {showControls ? (
              <>
                <div className="flex-1 min-w-0 md:flex-none md:w-[260px] lg:w-[340px]">
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder="Search series"
                    id="series-search"
                    ariaLabel="Search series"
                    clearOnEscape
                  />
                </div>
                <ViewSwitch view={view} onChange={chooseView} />
              </>
            ) : <span className="flex-1 md:hidden" />}
            <UserAvatarButton />
          </div>
        </header>
      </div>

      <div className="flex-1 w-full flex flex-col">
      <div className="w-full px-3 md:px-8 pt-6 md:pt-8 pb-2 space-y-9">
        {loadError ? (
          <p className="text-red-400 text-sm">Couldn&apos;t load the series in this collection: {loadError}</p>
        ) : !sorted ? (
          <div className="flex items-center gap-3 text-text-secondary py-6">
            <BiLoaderAlt className="w-5 h-5 animate-spin" /> Loading series…
          </div>
        ) : series && series.length === 0 ? (
          <p className="text-text-secondary text-sm">This collection has no series yet.</p>
        ) : sorted.length === 0 ? (
          <p className="text-text-secondary text-sm">No series match &ldquo;{query.trim()}&rdquo;.</p>
        ) : (
          <>
            {openable.length > 0 && (
              <section>
                <SectionHeading title="Release group series" count={openable.length} />
                <div className={view === 'grid' ? tileGridClass : rowListClass}>
                  {openable.map(s => (
                    <Tile
                      key={s.id}
                      view={view}
                      href={`${collectionPath('series', s.id)}?collection=${mbid}`}
                      name={s.name}
                      detail={counts[s.id] !== undefined
                        ? `${counts[s.id].toLocaleString()} release group${counts[s.id] === 1 ? '' : 's'}`
                        : s.disambiguation || 'Not opened yet'}
                      coverId={s.id}
                    />
                  ))}
                </div>
              </section>
            )}
            {other.length > 0 && (
              <section>
                <SectionHeading title="Other series" count={other.length} />
                <div className={rowListClass}>
                  {other.map(s => (
                    <UnsupportedRow
                      key={s.id}
                      name={s.name}
                      detail={`${s.type ? `${s.type} · ` : ''}not supported yet`}
                      mbUrl={`https://musicbrainz.org/series/${s.id}`}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
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
