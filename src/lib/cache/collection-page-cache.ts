/**
 * @ai-file cache
 * @ai-description Server-side copy of collection listing pages (release-group?collection=...), so a
 *   browser without its own IndexedDB copy loads a large collection in about a second instead of
 *   waiting for one rate-limited MusicBrainz request per 100 albums
 * @ai-dependencies base-cache
 * @ai-features
 * - Keyed by the MusicBrainz URL (path + query) and whether the request was signed in
 * - A signed-in copy is only served to signed-in requests (a private collection must not leak to
 *   visitors without a login); signed-in requests may also use the public copy
 * - Served at any age: the browser keeps it fresh with its own count check and daily refresh,
 *   which ask the proxy for live data (x-mb-refresh header) and so update this copy
 */

import { BaseCache } from './base-cache';

// Not used to drop entries (stale entries are still served), only for statistics
const COLLECTION_PAGE_TTL_SECONDS = 24 * 60 * 60;

export type PageAccess = 'auth' | 'public';

class CollectionPageCache extends BaseCache<unknown> {
  constructor() {
    super('collection-pages', COLLECTION_PAGE_TTL_SECONDS);
  }

  private key(access: PageAccess, url: URL): string {
    return `${access}:${url.pathname}${url.search}`;
  }

  /** The stored page for this URL that the request may see, if any */
  lookup(url: URL, signedIn: boolean): unknown | undefined {
    return (signedIn ? this.get(this.key('auth', url)) : undefined) ?? this.get(this.key('public', url));
  }

  store(url: URL, signedIn: boolean, page: unknown): void {
    this.set(this.key(signedIn ? 'auth' : 'public', url), page);
  }
}

/** True for a page of a collection's album list, the only request this cache holds */
export const isCollectionPageRequest = (segments: string[], searchParams: URLSearchParams): boolean =>
  segments.length === 1 && segments[0] === 'release-group' && searchParams.has('collection');

const globalForCollectionPages = globalThis as unknown as { collectionPageCache?: CollectionPageCache };
export const collectionPageCache =
  globalForCollectionPages.collectionPageCache ?? (globalForCollectionPages.collectionPageCache = new CollectionPageCache());
