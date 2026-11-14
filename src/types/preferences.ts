/**
 * @ai-file types
 * @ai-description User preference type definitions
 * @ai-dependencies SortOption from music types
 * @ai-features Preference interfaces, defaults, validation helpers, version management
 */

import { SortOption } from './music';

// Re-export SortOption so it can be imported from preferences
export type { SortOption };

export type ThemeOption = 'dark' | 'light' | 'system';
export type RatingDisplayMode = 'average' | 'personal';

export interface StreamingServicePreferences {
  spotify: boolean;
  appleMusic: boolean;
  youtube: boolean;
  youtubeMusic: boolean;
  amazon: boolean;
  amazonMusic: boolean;
  deezer: boolean;
  tidal: boolean;
  soundcloud: boolean;
  pandora: boolean;
  bandcamp: boolean;
  plex: boolean;
}

/** A service that can link to an album: the streaming platforms plus Plex */
export type StreamingServiceKey = keyof StreamingServicePreferences;

export const STREAMING_SERVICE_NAMES: Record<StreamingServiceKey, string> = {
  plex: 'Plex',
  spotify: 'Spotify',
  appleMusic: 'Apple Music',
  tidal: 'Tidal',
  deezer: 'Deezer',
  youtubeMusic: 'YouTube Music',
  youtube: 'YouTube',
  amazonMusic: 'Amazon Music',
  amazon: 'Amazon',
  bandcamp: 'Bandcamp',
  soundcloud: 'SoundCloud',
  pandora: 'Pandora',
};

/** Default order of the service icons (leftmost first); the grid's listen button opens the first one */
export const DEFAULT_STREAMING_ORDER = Object.keys(STREAMING_SERVICE_NAMES) as StreamingServiceKey[];

export interface DisplayPreferences {
  sortOption: SortOption;
  useGenresOnly: boolean;
  theme?: ThemeOption;
  showRatings: boolean;
  ratingDisplayMode: RatingDisplayMode;
  enableLabelFilter: boolean;
  /** "Recently opened" row on the Collections page */
  showRecentlyOpened: boolean;
}

export interface StreamingPreferences {
  spotifyUseDesktopApp: boolean;
  tidalUseDesktopApp: boolean;
  appleMusicUseDesktopApp: boolean;
  enabledServices: StreamingServicePreferences;
  /** Every service once, in the user's order (icons left to right; the listen button opens the first available) */
  serviceOrder: StreamingServiceKey[];
  country: string; // Two-letter store country for streaming links (Apple storefront, Spotify market, Tidal)
}

export interface ApiConfiguration {
  collectionId: string;
}

export interface CollectionMetadata {
  collectionName: string;
  lastUpdated?: string;
  entityType?: 'collection' | 'series';
}

/**
 * @ai-note Auth preferences for UI display only
 * @ai-security Token data stored in httpOnly cookies, not localStorage
 * @ai-usage Display username/userId in UI, actual authentication via cookies
 */
export interface AuthPreferences {
  isAuthenticated: boolean;
  username: string | null;
  userId: string | null;
}

export interface UserPreferences {
  version: number;
  display: DisplayPreferences;
  streaming: StreamingPreferences;
  api: ApiConfiguration;
  metadata: CollectionMetadata;
  auth: AuthPreferences;
}

// Default preference values
export const DEFAULT_STREAMING_SERVICES: StreamingServicePreferences = {
  spotify: true,
  appleMusic: true,
  youtube: true,
  youtubeMusic: true,
  amazon: true,
  amazonMusic: true,
  deezer: true,
  tidal: true,
  soundcloud: true,
  pandora: true,
  bandcamp: true,
  plex: true,
};

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  sortOption: 'artist-asc',
  useGenresOnly: true,
  theme: 'dark',
  showRatings: true,
  ratingDisplayMode: 'average',
  enableLabelFilter: false,
  showRecentlyOpened: true,
};

export const DEFAULT_STREAMING_PREFERENCES: StreamingPreferences = {
  spotifyUseDesktopApp: false,
  tidalUseDesktopApp: false,
  appleMusicUseDesktopApp: false,
  enabledServices: DEFAULT_STREAMING_SERVICES,
  serviceOrder: DEFAULT_STREAMING_ORDER,
  country: 'DE',
};

// Countries offered in settings (any two-letter code works in the APIs)
export const STREAMING_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AT', name: 'Austria' },
  { code: 'AU', name: 'Australia' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CA', name: 'Canada' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'DE', name: 'Germany' },
  { code: 'DK', name: 'Denmark' },
  { code: 'ES', name: 'Spain' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'SE', name: 'Sweden' },
  { code: 'US', name: 'United States' },
];

export const DEFAULT_API_CONFIGURATION: ApiConfiguration = {
  collectionId: '',
};

export const DEFAULT_COLLECTION_METADATA: CollectionMetadata = {
  collectionName: '',
};

export const DEFAULT_AUTH_PREFERENCES: AuthPreferences = {
  isAuthenticated: false,
  username: null,
  userId: null,
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  version: 1,
  display: DEFAULT_DISPLAY_PREFERENCES,
  streaming: DEFAULT_STREAMING_PREFERENCES,
  api: DEFAULT_API_CONFIGURATION,
  metadata: DEFAULT_COLLECTION_METADATA,
  auth: DEFAULT_AUTH_PREFERENCES,
};

// Utility types for partial updates
export type PreferenceCategory = keyof Omit<UserPreferences, 'version'>;
export type PartialPreferences<T extends PreferenceCategory> = Partial<UserPreferences[T]>;

// Type guards
export const isValidSortOption = (value: string): value is SortOption => {
  return ['artist-asc', 'artist-desc', 'title-asc', 'title-desc', 'date-old-new', 'date-new-old', 'rating-high-low', 'rating-low-high', 'series-order'].includes(value);
};

export const isValidThemeOption = (value: string): value is ThemeOption => {
  return ['dark', 'light', 'system'].includes(value);
};