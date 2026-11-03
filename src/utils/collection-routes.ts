/**
 * @ai-file utility
 * @ai-description URLs of the collection and series pages (/collection/[mbid], /series/[mbid])
 */

export type CollectionEntityType = 'collection' | 'series';

export interface CollectionRoute {
  entityType: CollectionEntityType;
  mbid: string;
}

/** App URL of a MusicBrainz collection or series, e.g. /collection/27a3c068-… */
export function collectionPath(entityType: CollectionEntityType, mbid: string): string {
  return `/${entityType}/${encodeURIComponent(mbid.toLowerCase())}`;
}
