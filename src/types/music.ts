/**
 * @ai-file types
 * @ai-description TypeScript interfaces for MusicBrainz entities
 * @ai-dependencies None
 * @ai-features
 * - Complete type definitions for MusicBrainz API responses
 * - Nested interface structure (Artist, ReleaseGroup, Release, Track, Media, ArtistCredit)
 * - Cover art, genres, tags, ratings, and streaming links
 * - Sort options enum
 */

export interface Artist {
  id: string;
  name: string;
  sort_name?: string;
  disambiguation?: string;
}

export interface Genre {
  name: string;
  count: number;
}

export interface Tag {
  name: string;
  count: number;
}

export interface Rating {
  average: number | null;     // 0-5 scale (5-star rating from MusicBrainz API)
  count: number;              // Number of community ratings
  personal: number | null;    // User's own rating (0-5 scale), null if not rated
  fetchedAt: number;          // Timestamp for cache management
  requiresAuth: boolean;      // Whether personal rating needs authentication
}

export interface StreamingLinks {
  spotify?: string;
  appleMusic?: string;
  youtube?: string;
  youtubeMusic?: string;
  amazon?: string;
  amazonMusic?: string;
  deezer?: string;
  tidal?: string;
  soundcloud?: string;
  pandora?: string;
  thumbnail?: string;
}

export interface ReleaseGroup {
  id: string;
  title: string;
  primary_type?: string;
  secondary_types?: string[];
  first_release_date?: string;
  disambiguation?: string;
  artist_credit: ArtistCredit[];
  releases?: Release[];
  cover?: string;
  selected?: boolean;
  genres?: string[] | Genre[];
  tags?: string[] | Tag[];
  tracklist?: Track[];
  selectedReleaseId?: string;
  streamingLinks?: StreamingLinks;
  releaseDetails?: Release;
  rating?: Rating;
  _cachedAt?: number;       // Timestamp when cached (milliseconds since epoch)
  _expiresAt?: number;      // Timestamp when cache expires (30-day TTL)
}

export interface ArtistCredit {
  artist: Artist;
  name: string;
  joinphrase?: string;
}

export interface LabelInfo {
  label: {
    id: string;
    name: string;
  };
  'catalog-number'?: string;
}

export interface Release {
  id: string;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  track_count?: number;
  media?: Media[];
  relations?: Relation[];
  'label-info'?: LabelInfo[];
}

export interface Relation {
  type: string;
  direction: string;
  url?: {
    id: string;
    resource: string;
  };
}

export interface Media {
  position: number;
  format?: string;
  track_count: number;
  tracks?: Track[];
}

export interface Track {
  id: string;
  number: string;
  title: string;
  length?: number;
  artist_credit?: ArtistCredit[];
}

export interface Collection {
  id: string;
  name: string;
  editor: string;
  entity_count: number;
  release_groups: ReleaseGroup[];
}

export interface CoverArt {
  images: CoverArtImage[];
}

export interface CoverArtImage {
  approved: boolean;
  back: boolean;
  comment: string;
  edit: number;
  front: boolean;
  id: string;
  image: string;
  thumbnails: {
    250?: string;
    500?: string;
    1200?: string;
    small?: string;
    large?: string;
  };
  types: string[];
}

export type SortOption =
  | 'artist-asc'
  | 'artist-desc'
  | 'title-asc'
  | 'title-desc'
  | 'date-old-new'
  | 'date-new-old';

export interface UserCollection {
  id: string;
  name: string;
  type: string;
  entity_count: number;
  editor: string;
  private?: boolean;
}

export type StorageType = 'session' | 'local' | 'memory';
