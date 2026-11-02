/**
 * @ai-file lib
 * @ai-description Links collection albums to the same albums in a Plex Media Server
 * @ai-dependencies release-store (cached releases with their release group)
 * @ai-features
 * - Off unless PLEX_TOKEN is set; the token is only used on the server, never sent to the browser
 * - Reads every album of every Plex music library with its MusicBrainz release ID (mbid:// guid)
 * - Maps each release to its release group through the release cache, so no MusicBrainz requests
 * - Builds Plex Web links (https://app.plex.tv/desktop/ by default, PLEX_WEB_URL to change)
 * - Plex album list kept in memory for 10 minutes (1 minute after an error), one Plex read at a time;
 *   matched against the release cache on every call, so newly cached albums get their link at once
 */

import { releaseStore } from '@/lib/cache/release-store';

export interface PlexConfig {
  url: string;
  token: string;
  webUrl: string;
}

export interface PlexAlbum {
  ratingKey: string;
  title: string;
  releaseMbid: string;
}

export interface PlexAlbumLinks {
  enabled: boolean;
  /** Plex Web link per release group MBID */
  albums: Record<string, string>;
  error?: string;
}

const DEFAULT_PLEX_URL = 'http://localhost:32400';
const DEFAULT_PLEX_WEB_URL = 'https://app.plex.tv/desktop/';
const REQUEST_TIMEOUT_MS = 10_000;
export const PLEX_LINKS_TTL_MS = 10 * 60 * 1000;
export const PLEX_ERROR_TTL_MS = 60 * 1000;

const MBID_GUID = /^mbid:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Plex settings from the environment, or null when the feature is off (no PLEX_TOKEN)
 */
export function getPlexConfig(env: Record<string, string | undefined> = process.env): PlexConfig | null {
  const token = env.PLEX_TOKEN?.trim();
  if (!token) return null;
  const webUrl = env.PLEX_WEB_URL?.trim() || DEFAULT_PLEX_WEB_URL;
  return {
    url: (env.PLEX_URL?.trim() || DEFAULT_PLEX_URL).replace(/\/+$/, ''),
    token,
    // Only http(s) links reach the browser
    webUrl: /^https?:\/\//i.test(webUrl) ? webUrl : DEFAULT_PLEX_WEB_URL,
  };
}

/**
 * Plex Web link that opens one album: <web>#!/server/<machine>/details?key=/library/metadata/<ratingKey>
 */
export function plexAlbumUrl(webUrl: string, machineIdentifier: string, ratingKey: string): string {
  const base = webUrl.split('#')[0];
  const key = encodeURIComponent(`/library/metadata/${ratingKey}`);
  return `${base}#!/server/${encodeURIComponent(machineIdentifier)}/details?key=${key}`;
}

interface PlexContainer {
  machineIdentifier?: string;
  Directory?: { key: string; type: string }[];
  Metadata?: { ratingKey?: string; title?: string; Guid?: { id?: string }[] }[];
}

async function plexGet(config: PlexConfig, path: string): Promise<PlexContainer> {
  const response = await fetch(`${config.url}${path}`, {
    // Token in a header, not the URL, so it never ends up in a logged URL
    headers: { Accept: 'application/json', 'X-Plex-Token': config.token },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (response.status === 401) throw new Error('Plex rejected PLEX_TOKEN (HTTP 401)');
  if (!response.ok) throw new Error(`Plex ${path.split('?')[0]} answered HTTP ${response.status}`);
  const body = (await response.json()) as { MediaContainer?: PlexContainer };
  return body.MediaContainer ?? {};
}

/**
 * The server's ID (for links) and every album in its music libraries that has a MusicBrainz release ID
 */
export async function fetchPlexAlbums(config: PlexConfig): Promise<{ machineIdentifier: string; albums: PlexAlbum[] }> {
  const identity = await plexGet(config, '/identity');
  const machineIdentifier = identity.machineIdentifier;
  if (!machineIdentifier) throw new Error('Plex /identity returned no machineIdentifier');

  const sections = (await plexGet(config, '/library/sections')).Directory ?? [];
  const albums: PlexAlbum[] = [];
  for (const section of sections.filter(s => s.type === 'artist')) {
    // type=9 = albums; includeGuids adds the external IDs (mbid://, discogs://, ...)
    const { Metadata = [] } = await plexGet(
      config,
      `/library/sections/${encodeURIComponent(section.key)}/all?type=9&includeGuids=1`
    );
    for (const item of Metadata) {
      const releaseMbid = (item.Guid ?? []).map(g => MBID_GUID.exec(g.id ?? '')?.[1]).find(Boolean);
      if (releaseMbid && item.ratingKey && /^\d+$/.test(item.ratingKey)) {
        albums.push({ ratingKey: item.ratingKey, title: item.title ?? '', releaseMbid: releaseMbid.toLowerCase() });
      }
    }
  }
  return { machineIdentifier, albums };
}

/**
 * Plex album per release group; the first Plex album wins when two share a release group
 */
export function matchReleaseGroups(
  albums: PlexAlbum[],
  releaseGroupOf: (releaseMbid: string) => string | undefined
): Record<string, PlexAlbum> {
  const matches: Record<string, PlexAlbum> = {};
  for (const album of albums) {
    const releaseGroupId = releaseGroupOf(album.releaseMbid);
    if (releaseGroupId && !matches[releaseGroupId]) {
      matches[releaseGroupId] = album;
    }
  }
  return matches;
}

/**
 * Release group of a release, from the release cache (filled by album fetches and the prefetch)
 */
const cachedReleaseGroupOf = (releaseMbid: string): string | undefined => releaseStore.get(releaseMbid)?.releaseGroupId;

interface PlexListing {
  machineIdentifier: string;
  albums: PlexAlbum[];
}

interface ListingState {
  listing?: PlexListing;
  error?: boolean;
  validUntil: number;
  pending?: Promise<void>;
}

const store = globalThis as typeof globalThis & { __plexListing?: ListingState };
const state = (): ListingState => (store.__plexListing ??= { validUntil: 0 });

/**
 * The Plex album list, read from Plex at most every 10 minutes (1 minute after an error)
 */
async function getPlexListing(config: PlexConfig, now: number): Promise<ListingState> {
  const current = state();
  if (now < current.validUntil) return current;

  current.pending ??= fetchPlexAlbums(config)
    .then(listing => {
      current.listing = listing;
      current.error = false;
      current.validUntil = Date.now() + PLEX_LINKS_TTL_MS;
      console.log(`🎞️ Plex: ${listing.albums.length} albums with a MusicBrainz ID`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Plex albums could not be read: ${message}`);
      current.listing = undefined;
      current.error = true;
      current.validUntil = Date.now() + PLEX_ERROR_TTL_MS;
    })
    .finally(() => {
      current.pending = undefined;
    });
  await current.pending;
  return current;
}

/**
 * Plex links for all linked albums, never throws. The Plex list is reused for 10 minutes, but it is
 * matched against the release cache on every call, so an album gets its link as soon as its releases
 * are cached (a few dozen local lookups, no MusicBrainz or Plex requests)
 */
export async function getPlexAlbumLinks(now: number = Date.now()): Promise<PlexAlbumLinks> {
  const config = getPlexConfig();
  if (!config) return { enabled: false, albums: {} };

  const { listing, error } = await getPlexListing(config, now);
  if (error || !listing) return { enabled: true, albums: {}, error: 'Plex could not be reached' };

  const links: Record<string, string> = {};
  for (const [releaseGroupId, album] of Object.entries(matchReleaseGroups(listing.albums, cachedReleaseGroupOf))) {
    links[releaseGroupId] = plexAlbumUrl(config.webUrl, listing.machineIdentifier, album.ratingKey);
  }
  return { enabled: true, albums: links };
}

/**
 * Forget the stored links (tests)
 */
export function resetPlexAlbumLinks(): void {
  store.__plexListing = undefined;
}
