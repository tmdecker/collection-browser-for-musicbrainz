/**
 * @ai-file component
 * @ai-description Collections page: the signed-in user's MusicBrainz collections grouped by entity type, the last opened one, and "Open by MBID or URL"
 * @ai-dependencies React, Next.js Link and router, AppMenu, useAuth, usePreferences, mbid-validation
 * @ai-features
 * - Groups collections by MusicBrainz entity type; release group and series collections open
 * - Shows the last known list at once (browser copy) and refreshes it in the background
 * - Each row links to its collection page; a MusicBrainz icon opens it on musicbrainz.org
 * - The last opened collection or series is marked, or listed on its own when it isn't one of yours
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
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { MusicBrainzCollection } from '@/types/auth';
import { validateEntityId, EntityType } from '@/utils/mbid-validation';
import { collectionPath } from '@/utils/collection-routes';
import { readCachedCollections, writeCachedCollections } from '@/utils/collection-info';
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

  const showView = isAuthenticated && !loading && !loadError && collections.length > 0;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-30 bg-background">
        <header className="relative p-3 md:px-8 md:pt-4 md:pb-4 header-surface">
          <div className="flex items-center gap-2 min-h-[40px] md:min-h-[42px]">
            <AppMenu />
            <nav aria-label="Breadcrumb" className="flex ml-1 text-[15px]">
              <span className="font-semibold text-white" aria-current="page">Collections</span>
            </nav>
            {showView && (
              <div className="ml-auto flex gap-0.5 p-[3px] rounded-full bg-background-control" role="group" aria-label="View">
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
            )}
          </div>
        </header>
      </div>

      <div className="w-full px-3 md:px-8 pt-6 md:pt-8 pb-8 space-y-8">
        {/* Recently opened, including series opened inside a series collection and public ones */}
        {recent.length > 0 && (
          <section>
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
            [...groups.entries()].map(([entityType, list]) => {
              const supported = SUPPORTED_ENTITY_TYPES.has(entityType);
              return (
                <section key={entityType}>
                  <h2 className={sectionHeadingClass}>{entityLabel(entityType)} collections</h2>
                  <div className={view === 'grid'
                    ? 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5 gap-y-6'
                    : 'max-w-3xl space-y-2'}>
                    {list.map(c => {
                      const count = entityCount(c);
                      const props = {
                        href: supported ? collectionPath('collection', c.id) : undefined,
                        name: c.name,
                        detail: supported ? (count !== undefined ? countLabel(entityType, count) : '') : `${entityLabel(entityType)} collection · not supported yet`,
                        mbUrl: `https://musicbrainz.org/collection/${c.id}`,
                        // Release group collections show their cached covers; series collections have none
                        coverId: entityType === 'release_group' ? c.id : undefined,
                      };
                      return view === 'grid' ? <CollectionCard key={c.id} {...props} /> : <CollectionRow key={c.id} {...props} />;
                    })}
                  </div>
                </section>
              );
            })
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

        {/* Open by MBID or URL */}
        <section className="max-w-3xl">
          <label htmlFor="open-by-id" className="block text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Open by MBID or URL
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                id="open-by-id"
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') openValidated(); }}
                placeholder="musicbrainz.org/collection/… or /series/…"
                className="w-full px-3 py-2 pr-16 bg-background-tertiary text-text-primary text-sm rounded-lg border border-white/10 focus:border-primary focus:outline-none placeholder:text-white/40"
              />
              {input && (
                <button
                  type="button"
                  onClick={() => setInput('')}
                  className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white/90 transition-colors"
                  aria-label="Clear input"
                >
                  <BiX className="w-5 h-5" />
                </button>
              )}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                {validation.status === 'validating' && <BiLoaderAlt className="w-4 h-4 text-white/40 animate-spin" />}
                {validation.status === 'valid' && <BiCheck className="w-5 h-5 text-green-500" />}
                {validation.status === 'error' && <BiError className="w-5 h-5 text-red-500" />}
              </div>
            </div>
            <button
              type="button"
              onClick={openValidated}
              disabled={validation.status !== 'valid'}
              className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              Open
            </button>
          </div>
          <p className={`mt-2 text-xs ${validation.status === 'error' ? 'text-red-400' : 'text-text-tertiary'}`}>
            {validation.status === 'error' ? validation.message : 'Any public collection or series. Paste its MBID or its musicbrainz.org address.'}
          </p>
        </section>

      </div>
    </main>
  );
}

const sectionHeadingClass = 'text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3';

interface CollectionItemProps {
  href?: string;          // missing: entity type the app can't show yet
  name: string;
  detail: string;
  mbUrl: string;
  coverId?: string;       // collection whose cached covers make the mosaic
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
function CollectionCard({ href, name, detail, mbUrl, coverId }: CollectionItemProps) {
  const mosaic = (
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
function CollectionRow({ href, name, detail, mbUrl, coverId }: CollectionItemProps) {
  const body = (
    <>
      <CoverMosaic
        collectionId={coverId}
        className="w-11 h-11 rounded-md flex-shrink-0"
        emptyIcon={href ? <BiCollection className="w-5 h-5" /> : undefined}
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
