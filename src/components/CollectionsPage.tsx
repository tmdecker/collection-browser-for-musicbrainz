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
import { BiCheck, BiError, BiLinkExternal, BiLoaderAlt, BiX } from 'react-icons/bi';
import { SiMusicbrainz } from 'react-icons/si';
import AppMenu from './AppMenu';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { MusicBrainzCollection } from '@/types/auth';
import { validateEntityId, EntityType } from '@/utils/mbid-validation';
import { collectionPath } from '@/utils/collection-routes';
import { readCachedCollections, writeCachedCollections } from '@/utils/collection-info';

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

  const lastIsListed = collections.some(c => c.id === lastId);

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

  const lastMarker = <span className="text-xs text-text-tertiary whitespace-nowrap">Last opened</span>;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-30 bg-background">
        <header className="relative p-3 md:px-6 md:pt-4 md:pb-4 header-surface">
          <div className="flex items-center gap-2 min-h-[40px] md:min-h-[42px]">
            <AppMenu />
            <h1 className="ml-1 md:ml-3 text-sm font-bold text-white">Collections</h1>
          </div>
        </header>
      </div>

      <div className="w-full max-w-3xl px-3 md:px-6 py-6 space-y-8">
        {/* Open by MBID or URL */}
        <section>
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

        {/* Last opened, when it isn't one of the signed-in user's collections (e.g. a public series) */}
        {lastId && !lastIsListed && !loading && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Last opened</h2>
            <CollectionRow
              href={collectionPath(lastType, lastId)}
              name={lastName || lastId}
              detail={lastType === 'series' ? 'Series' : 'Collection'}
              mbUrl={`https://musicbrainz.org/${lastType}/${lastId}`}
            />
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
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                    {entityLabel(entityType)} collections
                  </h2>
                  <div className="space-y-2">
                    {list.map(c => {
                      const count = entityCount(c);
                      return (
                        <CollectionRow
                          key={c.id}
                          href={supported ? collectionPath('collection', c.id) : undefined}
                          name={c.name}
                          detail={supported ? (count !== undefined ? countLabel(entityType, count) : '') : 'Not supported yet'}
                          marker={c.id === lastId ? lastMarker : undefined}
                          mbUrl={`https://musicbrainz.org/collection/${c.id}`}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })
          )
        ) : authState.status !== 'authenticating' && (
          <section className="rounded-2xl bg-background-secondary p-5">
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

interface CollectionRowProps {
  href?: string;          // missing: entity type the app can't show yet
  name: string;
  detail: string;
  marker?: React.ReactNode;
  mbUrl: string;
}

function CollectionRow({ href, name, detail, marker, mbUrl }: CollectionRowProps) {
  const body = (
    <>
      <span className={`font-medium truncate ${href ? 'text-text-primary' : 'text-text-tertiary'}`}>{name}</span>
      {marker}
      <span className={`ml-auto text-xs tabular-nums whitespace-nowrap ${href ? 'text-text-tertiary' : 'text-text-tertiary/70'}`}>{detail}</span>
    </>
  );
  return (
    <div className="group flex items-center gap-3 rounded-xl bg-background-secondary hover:bg-background-tertiary transition-colors pr-4">
      {href ? (
        <Link href={href} className="flex-1 min-w-0 flex items-center gap-3 py-3 pl-4">{body}</Link>
      ) : (
        <div className="flex-1 min-w-0 flex items-center gap-3 py-3 pl-4 cursor-default">{body}</div>
      )}
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
    </div>
  );
}
