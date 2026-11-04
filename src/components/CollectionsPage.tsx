/**
 * @ai-file component
 * @ai-description Collections page (home): recently opened, "Open by MBID or URL", and the signed-in user's collections grouped by entity type
 * @ai-dependencies React, Next.js Link and router, AppMenu, useAuth, usePreferences, mbid-validation
 * @ai-features
 * - Groups collections by MusicBrainz entity type; release group and series collections open
 * - Shows the last known list at once (browser copy) and refreshes it in the background
 * - Each row links to its collection page; a MusicBrainz icon opens it on musicbrainz.org
 * - Cover mosaics, grid or list view (remembered), and a "Recently opened" row
 * - Search filters collection names and the series inside series collections instantly
 * - Open any public collection or series by MBID or musicbrainz.org URL
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BiCheck, BiCollection, BiError, BiGridAlt, BiLinkExternal, BiListUl, BiLoaderAlt, BiX } from 'react-icons/bi';
import { SiMusicbrainz } from 'react-icons/si';
import AppMenu from './AppMenu';
import CoverMosaic from './CoverMosaic';
import SearchBar from './SearchBar';
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

const VIEW_KEY = 'mb-collections-view';
const RELEASE_GROUP_SERIES = 'Release group series';

const mbIconClass = 'inline-flex text-text-secondary hover:text-white transition-colors duration-200 flex-shrink-0';

export default function CollectionsPage() {
  const router = useRouter();
  const { authState, isAuthenticated, user, login } = useAuth();
  const { preferences } = usePreferences();
  const lastId = preferences.api.collectionId;
  const lastType: EntityType = preferences.metadata.entityType ?? 'collection';
  const lastName = preferences.metadata.collectionName;

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
  const [view, setView] = useState<'grid' | 'list'>('grid');
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(VIEW_KEY) === 'list') setView('list');
    } catch { /* storage blocked: grid */ }
  }, []);
  const chooseView = (next: 'grid' | 'list') => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* not remembered */ }
  };

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
  const visibleGroups = [...groups.entries()]
    .map(([entityType, list]) => [entityType, searching ? list.filter(c => matches(c.name)) : list] as const)
    .filter(([, list]) => list.length > 0);
  const gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5 gap-y-6';
  const listClass = 'max-w-3xl space-y-2';

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
            placeholder="Collection or series MBID or URL"
            className="block w-full h-[42px] pl-4 pr-16 text-sm text-white placeholder:text-white/55 bg-background-control rounded-full border border-white/15 hover:border-white/35 focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-colors"
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

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-30 bg-background">
        <header className="relative p-3 md:px-8 md:pt-4 md:pb-4 header-surface">
          {/* Same columns as a collection page: menu and breadcrumb, search, view switch */}
          <div className="flex items-center gap-2 min-h-[40px] md:min-h-[42px] md:grid md:grid-cols-[1fr_minmax(auto,28rem)_1fr] md:gap-4">
            <div className="flex items-center min-w-0 flex-shrink-0">
              <AppMenu />
              <nav aria-label="Breadcrumb" className={`${showView ? 'hidden md:flex' : 'flex'} ml-3 text-[15px]`}>
                <span className="font-semibold text-white" aria-current="page">Collections</span>
              </nav>
            </div>
            {showView && (
              <>
                <div className="flex-1 min-w-0 md:w-full md:justify-self-center">
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder="Search collections and series"
                    id="collections-search"
                    ariaLabel="Search collections and series"
                    clearOnEscape
                  />
                </div>
                <div className="flex gap-0.5 p-[3px] rounded-full bg-background-control md:justify-self-end" role="group" aria-label="View">
                  {(['grid', 'list'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => chooseView(v)}
                      aria-pressed={view === v}
                      title={v === 'grid' ? 'Grid' : 'List'}
                      aria-label={v === 'grid' ? 'Grid view' : 'List view'}
                      className={`w-9 h-9 grid place-items-center rounded-full transition-colors ${view === v ? 'bg-background-tertiary text-white' : 'text-text-tertiary hover:text-white'}`}
                    >
                      {v === 'grid' ? <BiGridAlt className="w-[18px] h-[18px]" /> : <BiListUl className="w-5 h-5" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>
      </div>

      <div className="w-full px-3 md:px-8 pt-6 md:pt-8 pb-8 space-y-9">
        {/* Recently opened, and Open by MBID or URL top right (below it on narrow screens); hidden while searching */}
        {!searching && (
          <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-10">
            {recent.length > 0 && (
              <section className="flex-1 min-w-0">
                <h2 className={sectionHeadingClass}>Recently opened</h2>
                <div className="flex flex-wrap gap-3">
                  {recent.slice(0, 6).map(entry => (
                    <Link
                      key={`${entry.entityType}:${entry.mbid}`}
                      href={recentHref(entry)}
                      className="flex items-center gap-3 min-w-0 max-w-full rounded-xl bg-background-secondary hover:bg-background-tertiary transition-colors py-2 pl-2 pr-4"
                    >
                      <CoverMosaic
                        collectionId={entry.kind === 'series_collection' ? undefined : entry.mbid}
                        seriesIds={entry.kind === 'series_collection' ? seriesLists[entry.mbid]?.map(x => x.id) : undefined}
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
            )}
            {recent.length === 0 && <div className="hidden lg:block flex-1" />}
            {openBox}
          </div>
        )}

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
              {visibleGroups.map(([entityType, list]) => {
                const supported = SUPPORTED_ENTITY_TYPES.has(entityType);
                return (
                  <section key={entityType}>
                    <h2 className={sectionHeadingClass}>
                      {entityLabel(entityType)} collections
                      <span className={sectionCountClass}>{list.length}</span>
                    </h2>
                    <div className={view === 'grid' ? gridClass : listClass}>
                      {list.map(c => {
                        const count = entityCount(c);
                        const series = entityType === 'series' ? seriesLists[c.id] : undefined;
                        const props: CollectionItemProps = {
                          href: supported ? collectionPath('collection', c.id) : undefined,
                          name: c.name,
                          detail: supported ? (count !== undefined ? countLabel(entityType, count) : '') : `${entityLabel(entityType)} collection · not supported yet`,
                          mbUrl: `https://musicbrainz.org/collection/${c.id}`,
                          // Release group collections show their cached covers, series collections one cover per opened series
                          coverId: entityType === 'release_group' ? c.id : undefined,
                          seriesCollection: entityType === 'series',
                          series,
                          count,
                        };
                        return view === 'grid' ? <CollectionCard key={c.id} {...props} /> : <CollectionRow key={c.id} {...props} />;
                      })}
                    </div>
                  </section>
                );
              })}

              {/* Series inside series collections that match the search */}
              {matchingSeries.length > 0 && (
                <section>
                  <h2 className={sectionHeadingClass}>
                    Series
                    <span className={sectionCountClass}>{matchingSeries.length}</span>
                  </h2>
                  <div className={view === 'grid' ? gridClass : listClass}>
                    {matchingSeries.map(({ series, collectionId, collectionName }) => {
                      const props: CollectionItemProps = {
                        href: series.type === RELEASE_GROUP_SERIES ? `${collectionPath('series', series.id)}?collection=${collectionId}` : undefined,
                        name: series.name,
                        detail: series.type === RELEASE_GROUP_SERIES ? `in ${collectionName}` : `${series.type ?? 'Series'} · not supported yet`,
                        mbUrl: `https://musicbrainz.org/series/${series.id}`,
                        coverId: series.id,
                      };
                      return view === 'grid' ? <CollectionCard key={series.id} {...props} /> : <CollectionRow key={series.id} {...props} />;
                    })}
                  </div>
                </section>
              )}

              {searching && visibleGroups.length === 0 && matchingSeries.length === 0 && (
                <p className="text-text-secondary text-sm">No collections or series match &ldquo;{query.trim()}&rdquo;.</p>
              )}
            </>
          )
        ) : authState.status !== 'authenticating' && (
          <section className="max-w-3xl rounded-2xl bg-background-secondary p-5">
            <h2 className="text-base font-semibold text-text-primary mb-1">Your collections</h2>
            <p className="text-sm text-text-secondary mb-4">Log in with your MusicBrainz account to see your collections, including private ones.</p>
            <button
              type="button"
              onClick={login}
              className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              Login with MusicBrainz
              <BiLinkExternal size={14} />
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

// Case- and accent-insensitive text for the name filter
const foldText = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const sectionHeadingClass = 'text-lg font-semibold text-text-primary mb-3';
const sectionCountClass = 'ml-2 text-sm font-normal text-text-tertiary tabular-nums';

interface CollectionItemProps {
  href?: string;          // missing: entity type the app can't show yet
  name: string;
  detail: string;
  mbUrl: string;
  coverId?: string;       // collection whose cached covers make the mosaic
  seriesCollection?: boolean;
  series?: SeriesSummary[]; // a series collection's series, if its page was opened in this browser
  count?: number;
}

/** Empty series collection tile: the first series names, or an icon when they aren't known yet */
function SeriesNames({ series, count }: { series?: SeriesSummary[]; count?: number }) {
  if (!series || series.length === 0) return <BiCollection className="w-8 h-8" />;
  const total = count ?? series.length;
  return (
    <div className="self-stretch justify-self-stretch flex flex-col justify-end p-4 text-left">
      {series.slice(0, 3).map((s, i) => (
        <span key={s.id} className={`block truncate text-[13px] text-text-secondary py-1.5 ${i > 0 ? 'border-t border-white/[0.07]' : ''}`}>{s.name}</span>
      ))}
      {total > 3 && <span className="text-xs text-text-tertiary pt-1">+ {(total - 3).toLocaleString()} more</span>}
    </div>
  );
}

function MusicBrainzLink({ name, mbUrl }: { name: string; mbUrl: string }) {
  return (
    <a
      href={mbUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${mbIconClass} md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100`}
      title="Open on MusicBrainz"
      aria-label={`Open ${name} on MusicBrainz`}
    >
      <SiMusicbrainz size={16} />
    </a>
  );
}

/** Grid view: cover mosaic with the name and count below */
function CollectionCard({ href, name, detail, mbUrl, coverId, seriesCollection, series, count }: CollectionItemProps) {
  const mosaic = seriesCollection ? (
    // A small stacked edge on top: a collection of series rather than of release groups
    <div className="relative pt-2">
      <span className="absolute top-0 inset-x-3 h-1 rounded-t bg-white/[0.12]" aria-hidden="true" />
      <span className="absolute top-1 inset-x-1.5 h-1 rounded-t bg-white/[0.18]" aria-hidden="true" />
      <CoverMosaic
        seriesIds={series?.map(s => s.id)}
        className="relative aspect-square w-full rounded-lg"
        emptyIcon={<SeriesNames series={series} count={count} />}
      />
    </div>
  ) : (
    <CoverMosaic
      collectionId={coverId}
      className="aspect-square w-full rounded-lg"
      emptyIcon={href ? <BiCollection className="w-8 h-8" /> : undefined}
    />
  );
  return (
    <div className={`group min-w-0 ${href ? '' : 'opacity-50'}`}>
      {href ? <Link href={href} className="block hover:opacity-90 transition-opacity">{mosaic}</Link> : mosaic}
      <div className="mt-2 flex items-center gap-2 min-w-0">
        {href ? (
          <Link href={href} className="min-w-0 truncate text-sm font-medium text-text-primary hover:text-white/80">{name}</Link>
        ) : (
          <span className="min-w-0 truncate text-sm font-medium text-text-tertiary">{name}</span>
        )}
        <span className="ml-auto" />
        <MusicBrainzLink name={name} mbUrl={mbUrl} />
      </div>
      <div className="text-[13px] text-text-tertiary truncate tabular-nums">{detail}</div>
    </div>
  );
}

/** List view: one compact row with a small mosaic */
function CollectionRow({ href, name, detail, mbUrl, coverId, seriesCollection, series, count }: CollectionItemProps) {
  const body = (
    <>
      <CoverMosaic
        collectionId={seriesCollection ? undefined : coverId}
        seriesIds={seriesCollection ? series?.map(s => s.id) : undefined}
        className="w-11 h-11 rounded-md flex-shrink-0"
        emptyIcon={!href ? undefined : seriesCollection && count !== undefined
          ? <span className="text-xs tabular-nums">{count.toLocaleString()}</span>
          : <BiCollection className="w-5 h-5" />}
      />
      <span className={`font-medium truncate ${href ? 'text-text-primary' : 'text-text-tertiary'}`}>{name}</span>
      <span className={`ml-auto text-xs tabular-nums whitespace-nowrap ${href ? 'text-text-tertiary' : 'text-text-tertiary/70'}`}>{detail}</span>
    </>
  );
  return (
    <div className={`group flex items-center gap-3 rounded-xl bg-background-secondary hover:bg-background-tertiary transition-colors pr-4 ${href ? '' : 'opacity-70'}`}>
      {href ? (
        <Link href={href} className="flex-1 min-w-0 flex items-center gap-3.5 py-2 pl-2">{body}</Link>
      ) : (
        <div className="flex-1 min-w-0 flex items-center gap-3.5 py-2 pl-2 cursor-default">{body}</div>
      )}
      <MusicBrainzLink name={name} mbUrl={mbUrl} />
    </div>
  );
}
