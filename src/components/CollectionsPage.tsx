/**
 * @ai-file component
 * @ai-description Collections page (home): recently opened and the signed-in user's collections grouped by entity type;
 *   the search bar also opens any collection or series from a pasted MBID or musicbrainz.org link
 * @ai-dependencies React, Next.js Link and router, useAuth, usePreferences, mbid-validation
 * @ai-features
 * - Groups collections by MusicBrainz entity type; release group and series collections open,
 *   other types are plain rows under "Other collections"
 * - Login and account via the avatar button in the header
 * - Shows the last known list at once (browser copy) and refreshes it in the background
 * - Each card or row links to its collection page (whose footnote links to musicbrainz.org); rows the app can't open
 *   have a MusicBrainz icon instead
 * - Colour tiles in the grid, single covers in the list (looked up in the background on a new browser),
 *   grid or list view (remembered), and a
 *   "Recently opened" row (one cover per entry) that can be hidden in Settings; without it the collections start at the top
 * - Search filters collection names and the series inside series collections instantly
 * - A pasted MBID or collection/series link shows one result under the search bar instead (Enter opens it):
 *   own collections and series at once, anything else after a MusicBrainz lookup; shown when logged out too
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BiCollection, BiLoaderAlt } from 'react-icons/bi';
import AuthResultToast from './AuthResultToast';
import CoverThumb from './CoverThumb';
import SearchBar from './SearchBar';
import UserAvatarButton from './UserAvatarButton';
import { SectionHeading, Tile, UnsupportedRow, ViewSwitch, foldText, rowListClass, sectionHeadingClass, tileGridClass, useTileView } from './CollectionTiles';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { MusicBrainzCollection } from '@/types/auth';
import { classifyOpenInput, validateEntityId, EntityType } from '@/utils/mbid-validation';
import { collectionPath } from '@/utils/collection-routes';
import { readCachedCollections, readCachedSeries, writeCachedCollections, type SeriesSummary } from '@/utils/collection-info';
import { readRecentlyOpened, recentHref, recentKindLabel, type RecentEntry } from '@/utils/recently-opened';

// Entity types the app can show (MusicBrainz writes them with an underscore)
const SUPPORTED_ENTITY_TYPES = new Set(['release_group', 'series']);
const ENTITY_ORDER = ['release_group', 'series', 'release', 'artist', 'recording', 'work', 'label', 'event', 'place', 'area', 'instrument'];

// "release_group" -> "Release group"
const entityLabel = (entityType: string) => {
  const words = entityType.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// "1,226 release groups", "3 series"
const countLabel = (entityType: string, count: number) => {
  const noun = entityType.replace(/_/g, ' ');
  const plural = count === 1 || noun.endsWith('series') ? noun : `${noun}s`;
  return `${count.toLocaleString()} ${plural}`;
};

// MusicBrainz names the count after the entity type, e.g. "release-group-count"
const entityCount = (collection: MusicBrainzCollection): number | undefined => {
  const value = (collection as unknown as Record<string, unknown>)[`${collection['entity-type'].replace(/_/g, '-')}-count`];
  return typeof value === 'number' ? value : undefined;
};

const RELEASE_GROUP_SERIES = 'Release group series';

// What a pasted MBID or link would open, shown under the search bar
type OpenResult =
  | { status: 'validating' }
  | { status: 'error'; message: string }
  | { status: 'valid'; name: string; detail: string; href: string; coverId?: string; seriesCollectionId?: string };

export default function CollectionsPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { preferences } = usePreferences();
  const lastId = preferences.api.collectionId;
  const lastType: EntityType = preferences.metadata.entityType ?? 'collection';
  const lastName = preferences.metadata.collectionName;
  const recentAllowed = preferences.display.showRecentlyOpened;

  // The signed-in user's collections
  const [collections, setCollections] = useState<MusicBrainzCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Show the last known list at once and refresh it in the background
  useEffect(() => {
    if (!isAuthenticated || !user?.name) return;
    const username = user.name;
    let cancelled = false;
    const cached = readCachedCollections(username);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) setCollections(cached.collections);
    // A list fetched within the last minute is fresh enough (saves MusicBrainz requests when going back and forth)
    if (cached && Date.now() - cached.fetchedAt < 60_000) return;
    if (!cached) setLoading(true);
    setLoadError(null);
    fetch(`/api/musicbrainz/collections?username=${encodeURIComponent(username)}`)
      .then(async response => {
        if (!response.ok) throw new Error(`MusicBrainz answered ${response.status}`);
        const data = await response.json();
        const list: MusicBrainzCollection[] = data.collections ?? [];
        writeCachedCollections(username, list);
        if (!cancelled) setCollections(list);
      })
      .catch(err => {
        // A failed refresh keeps showing the last known list
        if (!cancelled && !cached) setLoadError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.name]);

  // Group by entity type in a fixed order
  const groups = new Map<string, MusicBrainzCollection[]>();
  [...collections]
    .sort((a, b) => {
      const ai = ENTITY_ORDER.indexOf(a['entity-type']);
      const bi = ENTITY_ORDER.indexOf(b['entity-type']);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name);
    })
    .forEach(c => groups.set(c['entity-type'], [...(groups.get(c['entity-type']) ?? []), c]));


  // View of the collection sections, remembered in this browser; Recently opened looks the same in both
  const [view, chooseView] = useTileView();

  // Recently opened, newest first; before this list existed only the last opened one was remembered
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  useEffect(() => {
    const list = readRecentlyOpened();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(list.length > 0 || !lastId || !lastName ? list : [{
      entityType: lastType,
      mbid: lastId,
      name: lastName,
      kind: lastType === 'series' ? 'series' : 'release_group_collection',
      openedAt: 0,
    }]);
  }, [lastId, lastName, lastType]);

  // Series of each series collection, as last seen on its page (no MusicBrainz requests here)
  const [seriesLists, setSeriesLists] = useState<Record<string, SeriesSummary[]>>({});
  useEffect(() => {
    const ids = new Set([
      ...collections.filter(c => c['entity-type'] === 'series').map(c => c.id),
      ...recent.filter(e => e.kind === 'series_collection').map(e => e.mbid),
    ]);
    const lists: Record<string, SeriesSummary[]> = {};
    ids.forEach(id => { const cached = readCachedSeries(id); if (cached) lists[id] = cached.series; });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeriesLists(lists);
  }, [collections, recent]);

  // Instant name filter for collections and the series inside series collections,
  // unless the text is an MBID or musicbrainz.org link: then it offers to open that instead
  const [query, setQuery] = useState('');
  const openInput = classifyOpenInput(query);
  const needle = openInput ? '' : foldText(query.trim());
  const searching = needle.length > 0;
  const matches = (name: string) => foldText(name).includes(needle);

  const matchingSeries = (() => {
    if (!needle) return [];
    const seen = new Set<string>();
    const hits: { series: SeriesSummary; collectionId: string; collectionName: string }[] = [];
    collections.filter(c => c['entity-type'] === 'series').forEach(c => {
      (seriesLists[c.id] ?? []).forEach(series => {
        if (seen.has(series.id) || !foldText(series.name).includes(needle)) return;
        seen.add(series.id);
        hits.push({ series, collectionId: c.id, collectionName: c.name });
      });
    });
    return hits.sort((a, b) => a.series.name.localeCompare(b.series.name));
  })();

  // A pasted MBID or link: own collections and series are known at once, anything else is looked up
  const openTarget = openInput?.kind === 'id' ? openInput : null;
  const ownResult = ((): OpenResult | null => {
    if (!openTarget) return null;
    const { mbid, entityType } = openTarget;
    if (entityType !== 'series') {
      const own = collections.find(c => c.id.toLowerCase() === mbid);
      if (own) {
        const type = own['entity-type'];
        if (!SUPPORTED_ENTITY_TYPES.has(type)) {
          return { status: 'error', message: `“${own.name}” is your ${entityLabel(type).toLowerCase()} collection. Only release group collections and series can be opened.` };
        }
        const count = entityCount(own);
        return {
          status: 'valid',
          name: own.name,
          detail: `Your ${type === 'series' ? 'series collection' : 'collection'}${count !== undefined ? ` · ${countLabel(type, count)}` : ''}`,
          href: collectionPath('collection', own.id),
          coverId: type === 'series' ? undefined : own.id,
          seriesCollectionId: type === 'series' ? own.id : undefined,
        };
      }
    }
    if (entityType !== 'collection') {
      for (const c of collections.filter(x => x['entity-type'] === 'series')) {
        const series = seriesLists[c.id]?.find(x => x.id.toLowerCase() === mbid);
        if (series && series.type === RELEASE_GROUP_SERIES) {
          return {
            status: 'valid',
            name: series.name,
            detail: `Series in ${c.name}`,
            href: `${collectionPath('series', series.id)}?collection=${c.id}`,
            coverId: series.id,
          };
        }
      }
    }
    return null;
  })();

  const lookupKey = openTarget && !ownResult ? `${openTarget.entityType ?? 'any'}:${openTarget.mbid}` : null;
  const [lookup, setLookup] = useState<{ key: string; result: OpenResult } | null>(null);
  useEffect(() => {
    if (!lookupKey) return;
    let cancelled = false;
    const [type, mbid] = lookupKey.split(':');
    const timer = setTimeout(async () => {
      const result = await validateEntityId(type === 'any' ? mbid : `https://musicbrainz.org/${type}/${mbid}`);
      if (cancelled) return;
      setLookup({
        key: lookupKey,
        result: result.valid && result.entityType ? {
          status: 'valid',
          name: result.name || 'Untitled',
          detail: `${result.entityType === 'series' ? 'Series' : 'Collection'}${result.count !== undefined ? ` · ${countLabel('release_group', result.count)}` : ''}`,
          href: collectionPath(result.entityType, mbid),
          coverId: mbid,
        } : { status: 'error', message: result.message },
      });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [lookupKey]);

  const openResult: OpenResult | null = openInput?.kind === 'unsupported'
    ? { status: 'error', message: openInput.message }
    : ownResult ?? (lookupKey ? (lookup?.key === lookupKey ? lookup.result : { status: 'validating' }) : null);
  const [popupOpen, setPopupOpen] = useState(true);
  const showPopup = popupOpen && openResult !== null;
  const openFromSearch = () => {
    if (openResult?.status === 'valid') router.push(openResult.href);
  };

  const showView = isAuthenticated && !loading && !loadError && collections.length > 0;
  const filtered = (list: MusicBrainzCollection[]) => searching ? list.filter(c => matches(c.name)) : list;
  const visibleGroups = [...groups.entries()]
    .filter(([entityType]) => SUPPORTED_ENTITY_TYPES.has(entityType))
    .map(([entityType, list]) => [entityType, filtered(list)] as const)
    .filter(([, list]) => list.length > 0);
  // Types the app can't open yet: one section of plain rows, no covers
  const unsupported = filtered([...groups.entries()].filter(([t]) => !SUPPORTED_ENTITY_TYPES.has(t)).flatMap(([, list]) => list));

  const showRecent = recentAllowed && recent.length > 0;
  const recentSection = (
    <section className="flex-1 min-w-0">
      <h2 className={sectionHeadingClass}>Recently opened</h2>
      <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {recent.slice(0, 6).map(entry => (
          <Link
            key={`${entry.entityType}:${entry.mbid}`}
            href={recentHref(entry)}
            className="flex items-center gap-3 min-w-0 rounded-xl bg-background-secondary hover:bg-background-tertiary transition-colors py-2 pl-2 pr-4"
          >
            <CoverThumb
              collectionId={entry.kind === 'series_collection' ? undefined : entry.mbid}
              fetchMissing={entry.kind === 'release_group_collection' ? 'collection' : entry.kind === 'series' ? 'series' : undefined}
              seriesIds={entry.kind === 'series_collection' ? seriesLists[entry.mbid]?.map(x => x.id) : undefined}
              seriesCollectionId={entry.kind === 'series_collection' ? entry.mbid : undefined}
              className="w-10 h-10 rounded-md flex-shrink-0"
              emptyIcon={<BiCollection className="w-5 h-5" />}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-text-primary">{entry.name}</span>
              <span className="block truncate text-xs text-text-tertiary">{recentKindLabel[entry.kind]}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );

  const collectionSections = (
    <>
      {/* Your collections */}
      {isAuthenticated ? (
        loading ? (
          <div className="flex items-center gap-3 text-text-secondary py-6">
            <BiLoaderAlt className="w-5 h-5 animate-spin" /> Loading your collections…
          </div>
        ) : loadError ? (
          <p className="text-red-400 text-sm">Couldn&apos;t load your collections: {loadError}</p>
        ) : collections.length === 0 ? (
          <p className="text-text-secondary text-sm">You have no collections on MusicBrainz yet.</p>
        ) : (
          <>
            {visibleGroups.map(([entityType, list]) => (
              <section key={entityType}>
                <SectionHeading title={`${entityLabel(entityType)} collections`} count={list.length} />
                <div className={view === 'grid' ? tileGridClass : rowListClass}>
                  {list.map((c, i) => {
                    const count = entityCount(c);
                    return (
                      <Tile
                        key={c.id}
                        view={view}
                        href={collectionPath('collection', c.id)}
                        name={c.name}
                        detail={count !== undefined ? countLabel(entityType, count) : ''}
                        // Release group collections show their covers, series collections one cover per opened series;
                        // looked up in the background when this browser has none
                        coverId={c.id}
                        fetchCovers="collection"
                        seriesCollection={entityType === 'series'}
                        series={entityType === 'series' ? seriesLists[c.id] : undefined}
                        count={count}
                        index={i}
                      />
                    );
                  })}
                </div>
              </section>
            ))}

            {/* Series inside series collections that match the search */}
            {matchingSeries.length > 0 && (
              <section>
                <SectionHeading title="Series" count={matchingSeries.length} />
                <div className={view === 'grid' ? tileGridClass : rowListClass}>
                  {matchingSeries.map(({ series, collectionId, collectionName }, i) => series.type === RELEASE_GROUP_SERIES ? (
                    <Tile
                      key={series.id}
                      view={view}
                      href={`${collectionPath('series', series.id)}?collection=${collectionId}`}
                      name={series.name}
                      detail={`in ${collectionName}`}
                      coverId={series.id}
                      fetchCovers="series"
                      index={i}
                    />
                  ) : (
                    <UnsupportedRow
                      key={series.id}
                      name={series.name}
                      detail={`${series.type ?? 'Series'} · not supported yet`}
                      mbUrl={`https://musicbrainz.org/series/${series.id}`}
                    />
                  ))}
                </div>
              </section>
            )}

            {unsupported.length > 0 && (
              <section>
                <SectionHeading title="Other collections" count={unsupported.length} />
                <div className={rowListClass}>
                  {unsupported.map(c => {
                    const count = entityCount(c);
                    return (
                      <UnsupportedRow
                        key={c.id}
                        name={c.name}
                        detail={`${count !== undefined ? `${countLabel(c['entity-type'], count)} · ` : `${entityLabel(c['entity-type'])} collection · `}not supported yet`}
                        mbUrl={`https://musicbrainz.org/collection/${c.id}`}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {searching && visibleGroups.length === 0 && matchingSeries.length === 0 && unsupported.length === 0 && (
              <p className="text-text-secondary text-sm">No collections or series match &ldquo;{query.trim()}&rdquo;.</p>
            )}
          </>
        )
      ) : (
        <p className="text-text-secondary text-sm">
          Log in (top right) to see your MusicBrainz collections, including private ones.
          Any public collection or series opens from its MBID or link in the search bar.
        </p>
      )}
    </>
  );

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <AuthResultToast />
      <div className="sticky top-0 z-30 bg-background">
        <header className="relative p-3 md:px-8 md:pt-4 md:pb-4 header-surface">
          {/* Same layout as a collection page: breadcrumb left; search, view switch and account right */}
          <div className="flex items-center gap-2 md:gap-3 min-h-[40px] md:min-h-[42px]">
            <div className="flex items-center min-w-0 flex-shrink-0 md:flex-1">
              <nav aria-label="Breadcrumb" className="hidden md:flex text-[15px]">
                <span className="font-semibold text-white" aria-current="page">Collections</span>
              </nav>
            </div>
            {/* On phones the result spans the header; from md on it sits under the search bar */}
            <div
              className="flex-1 min-w-0 md:flex-none md:w-[300px] lg:w-[340px] md:relative"
              onFocus={() => setPopupOpen(true)}
              onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPopupOpen(false); }}
            >
              <SearchBar
                value={query}
                onChange={value => { setQuery(value); setPopupOpen(true); }}
                placeholder={isAuthenticated ? 'Search, or paste an MBID or URL' : 'Paste an MBID or URL'}
                compactPlaceholder={isAuthenticated ? 'Search or paste MBID' : 'Paste an MBID or URL'}
                id="collections-search"
                ariaLabel="Search collections and series, or paste an MBID or MusicBrainz link"
                clearOnEscape
                onKeyDown={e => { if (e.key === 'Enter') openFromSearch(); }}
                controlsId="open-result"
                expanded={showPopup}
              />
              {showPopup && openResult && (
                <div
                  id="open-result"
                  role={openResult.status === 'valid' ? 'listbox' : 'status'}
                  // Keep the focus in the field while clicking the result (Safari doesn't focus links on click)
                  onMouseDown={e => e.preventDefault()}
                  className="absolute z-40 left-3 right-3 top-full mt-1 md:left-0 md:right-0 md:mt-2 p-1.5 rounded-2xl bg-background-secondary border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
                >
                  {openResult.status === 'valid' ? (
                    <Link
                      href={openResult.href}
                      role="option"
                      aria-selected="true"
                      className="flex items-center gap-3 min-w-0 rounded-xl p-2 bg-background-tertiary hover:bg-white/15 transition-colors"
                    >
                      <CoverThumb
                        collectionId={openResult.coverId}
                        seriesIds={openResult.seriesCollectionId ? seriesLists[openResult.seriesCollectionId]?.map(x => x.id) : undefined}
                        seriesCollectionId={openResult.seriesCollectionId}
                        className="w-10 h-10 rounded-md flex-shrink-0"
                        emptyIcon={<BiCollection className="w-5 h-5" />}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-primary">{openResult.name}</span>
                        <span className="block truncate text-xs text-text-tertiary">{openResult.detail}</span>
                      </span>
                      <kbd className="hidden md:inline flex-shrink-0 px-1.5 rounded border border-white/15 text-[11px] font-sans text-text-tertiary">Enter</kbd>
                    </Link>
                  ) : openResult.status === 'validating' ? (
                    <p className="flex items-center gap-2.5 p-2.5 text-sm text-text-secondary">
                      <BiLoaderAlt className="w-4 h-4 animate-spin flex-shrink-0" /> Looking it up on MusicBrainz…
                    </p>
                  ) : (
                    <p className="p-2.5 text-sm text-red-400">{openResult.message}</p>
                  )}
                </div>
              )}
            </div>
            {showView && <ViewSwitch view={view} onChange={chooseView} />}
            <UserAvatarButton />
          </div>
        </header>
      </div>

      <div className="w-full px-3 md:px-8 pt-6 md:pt-8 pb-8 space-y-9">
        {/* Recently opened (hidden while searching), then the collections */}
        {showRecent && !searching && recentSection}
        {collectionSections}
      </div>
    </main>
  );
}


