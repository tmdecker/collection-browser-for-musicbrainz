/**
 * @ai-file hook
 * @ai-description Plex Web links of the albums that are in the user's Plex library
 * @ai-features
 * - One request to /api/plex/albums per page load, shared by every component that uses the hook
 * - Returns an empty map when Plex is not configured or not reachable
 */

import { useEffect, useState } from 'react';

type PlexLinks = Record<string, string>;

let request: Promise<PlexLinks> | null = null;

const loadPlexLinks = (): Promise<PlexLinks> =>
  (request ??= fetch('/api/plex/albums')
    .then(response => (response.ok ? response.json() : { albums: {} }))
    .then((data: { albums?: PlexLinks }) => data.albums ?? {})
    .catch(() => ({})));

/**
 * Map of release group MBID to its Plex Web link
 */
export function usePlexAlbums(): PlexLinks {
  const [links, setLinks] = useState<PlexLinks>({});

  useEffect(() => {
    let active = true;
    loadPlexLinks().then(result => {
      if (active) setLinks(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return links;
}
