/**
 * @ai-file utility
 * @ai-description The open album as part of the page address (?album=<release group MBID>)
 * @ai-features
 * - Reads and writes the album parameter, keeping every other part of the address (e.g. ?collection=)
 * - Only real MBIDs are read back, so a mangled link opens the collection without an album
 */

import { isMbid } from './mbid-validation';

const ALBUM_PARAM = 'album';

/** The album MBID in an address, or null */
export const albumFromUrl = (href: string): string | null => {
  const value = new URL(href).searchParams.get(ALBUM_PARAM)?.toLowerCase() ?? null;
  return isMbid(value) ? value : null;
};

/** The same address with this album open (or none), as a path with query and hash */
export const urlWithAlbum = (href: string, albumId: string | null): string => {
  const url = new URL(href);
  if (albumId) {
    url.searchParams.set(ALBUM_PARAM, albumId);
  } else {
    url.searchParams.delete(ALBUM_PARAM);
  }
  return `${url.pathname}${url.search}${url.hash}`;
};
