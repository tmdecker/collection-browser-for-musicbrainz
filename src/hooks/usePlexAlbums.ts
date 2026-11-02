/**
 * @ai-file hook
 * @ai-description Plex Web links of the albums that are in the user's Plex library
 * @ai-features
 * - One request to /api/plex/albums per page load, shared by every component that uses the hook
 * - recheckPlexLink(albumId): asks again once per album when its details have loaded (the server
 *   can only link an album after its releases are cached)
 * - Returns an empty map when Plex is not configured or not reachable
 */

import { useEffect, useState } from 'react';

type PlexLinks = Record<string, string>;

let links: PlexLinks = {};
let enabled = false;
let request: Promise<void> | null = null;
const rechecked = new Set<string>();
const listeners = new Set<(links: PlexLinks) => void>();

const load = (): Promise<void> =>
  (request ??= fetch('/api/plex/albums', { cache: 'no-store' })
    .then(response => (response.ok ? response.json() : { enabled: false, albums: {} }))
    .then((data: { enabled?: boolean; albums?: PlexLinks }) => {
      enabled = !!data.enabled;
      links = data.albums ?? {};
      listeners.forEach(listener => listener(links));
    })
    .catch(() => {}));

/**
 * Ask the server again for an album without a link (at most once per album and page load)
 */
export function recheckPlexLink(albumId: string): void {
  // Wait for the first load (or a request still running), then decide
  void load().then(() => {
    if (!enabled || links[albumId] || rechecked.has(albumId)) return;
    rechecked.add(albumId);
    request = null;
    return load();
  });
}

/**
 * Map of release group MBID to its Plex Web link
 */
export function usePlexAlbums(): PlexLinks {
  const [current, setCurrent] = useState<PlexLinks>(links);

  useEffect(() => {
    listeners.add(setCurrent);
    void load();
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  return current;
}
