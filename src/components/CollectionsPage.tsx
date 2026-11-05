/**
 * @ai-file component
 * @ai-description Collections page (home): recently opened, "Open by MBID or URL", and the signed-in user's collections grouped by entity type
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
 * - Open any public collection or series by MBID or musicbrainz.org URL
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BiCheck, BiCollection, BiError, BiLoaderAlt, BiX } from 'react-icons/bi';
import AuthResultToast from './AuthResultToast';
import CoverThumb from './CoverThumb';
import SearchBar from './SearchBar';
import UserAvatarButton from './UserAvatarButton';
import { SectionHeading, Tile, UnsupportedRow, ViewSwitch, foldText, rowListClass, sectionHeadingClass, tileGridClass, useTileView } from './CollectionTiles';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { MusicBrainzCollection } from '@/types/auth';
import { validateEntityId, EntityType } from '@/utils/mbid-validation';
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


  // Open by MBID or URL
  const [input, setInput] = useState('');
  const [validation, setValidation] = useState<{ status: 'idle' | 'validating' | 'valid' | 'error'; message: string; mbid?: string; entityType?: EntityType }>({ status: 'idle', message: '' });
  const validationRunRef = useRef(0);

  const validate = useCallback(async (value: string) => {
    const run = ++validationRunRef.current;
    if (!value.trim()) {
      setValidation({ status: 'idle', message: '' });
      return;
    }
    setValidation({ status: 'validating', message: '' });
    const result = await validateEntityId(value);
    if (run !== validationRunRef.current) return;
    if (result.valid && result.mbid && result.entityType) {
      setValidation({ status: 'valid', message: result.message, mbid: result.mbid, entityType: result.entityType });
    } else {
      setValidation({ status: 'error', message: result.message });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => validate(input), 600);
    return () => clearTimeout(timer);
  }, [input, validate]);

  const openValidated = () => {
    if (validation.status !== 'valid' || !validation.mbid || !validation.entityType) return;
    router.push(collectionPath(validation.entityType, validation.mbid));
  };

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

  // Instant name filter for collections and the series inside series collections
  const [query, setQuery] = useState('');
  const needle = foldText(query.trim());
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

  const showView = isAuthenticated && !loading && !loadError && collections.length > 0;
  const filtered = (list: MusicBrainzCollection[]) => searching ? list.filter(c => matches(c.name)) : list;
  const visibleGroups = [...groups.entries()]
    .filter(([entityType]) => SUPPORTED_ENTITY_TYPES.has(entityType))
    .map(([entityType, list]) => [entityType, filtered(list)] as const)
    .filter(([, list]) => list.length > 0);
  // Types the app can't open yet: one section of plain rows, no covers
  const unsupported = filtered([...groups.entries()].filter(([t]) => !SUPPORTED_ENTITY_TYPES.has(t)).flatMap(([, list]) => list));

  const openBox = (
    <section className="w-full lg:w-[340px] lg:flex-none">
      <label htmlFor="open-by-id" className={`block ${sectionHeadingClass}`}>
        Open by MBID or URL
      </label>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <input
            id="open-by-id"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') openValidated(); }}
            placeholder="Paste an MBID or URL"
            className={`block w-full h-[42px] pl-4 ${input ? 'pr-16' : 'pr-4'} text-sm text-white placeholder:text-white/55 bg-background-control rounded-full border border-white/15 hover:border-white/35 focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-colors`}
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput('')}
              className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white/90 transition-colors"
              aria-label="Clear input"
            >
              <BiX className="w-5 h-5" />
            </button>
          )}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {validation.status === 'validating' && <BiLoaderAlt className="w-4 h-4 text-white/40 animate-spin" />}
            {validation.status === 'valid' && <BiCheck className="w-5 h-5 text-green-500" />}
            {validation.status === 'error' && <BiError className="w-5 h-5 text-red-500" />}
          </div>
        </div>
        <button
          type="button"
          onClick={openValidated}
          disabled={validation.status !== 'valid'}
          className="h-[42px] px-6 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          Open
        </button>
      </div>
      <p className={`mt-2 text-xs ${validation.status === 'error' ? 'text-red-400' : 'text-text-tertiary'}`}>
        {validation.status === 'error' ? validation.message : 'Any public collection or series.'}
      </p>
    </section>
  );

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
        <p className="text-text-secondary text-sm">Log in (top right) to see your MusicBrainz collections, including private ones.</p>
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
              <nav aria-label="Breadcrumb" className={`${showView ? 'hidden md:flex' : 'flex'} text-[15px]`}>
                <span className="font-semibold text-white" aria-current="page">Collections</span>
              </nav>
            </div>
            {showView ? (
              <>
                <div className="flex-1 min-w-0 md:flex-none md:w-[260px] lg:w-[340px]">
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder="Search collections and series"
                    id="collections-search"
                    ariaLabel="Search collections and series"
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

      <div className="w-full px-3 md:px-8 pt-6 md:pt-8 pb-8 space-y-9">
        {showRecent ? (
          <>
            {/* Recently opened, and Open by MBID or URL top right (below it on narrow screens); hidden while searching */}
            {!searching && (
              <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-10">
                {recentSection}
                {openBox}
              </div>
            )}
            {collectionSections}
          </>
        ) : (
          // Nothing recent (or hidden in Settings): the collections move up, Open by MBID or URL stays
          // top right (above them on narrow screens); hidden while searching
          <div className="flex flex-col-reverse lg:flex-row lg:items-start gap-8 lg:gap-10">
            <div className="flex-1 min-w-0 space-y-9">{collectionSections}</div>
            {!searching && openBox}
          </div>
        )}
      </div>
    </main>
  );
}


