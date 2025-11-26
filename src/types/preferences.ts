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
}

export interface DisplayPreferences {
  sortOption: SortOption;
  useGenresOnly: boolean;
  theme?: ThemeOption;
  showRatings: boolean;
  ratingDisplayMode: RatingDisplayMode;
  enableLabelFilter: boolean;
}

export interface StreamingPreferences {
  spotifyUseDesktopApp: boolean;
  tidalUseDesktopApp: boolean;
  appleMusicUseDesktopApp: boolean;
  enabledServices: StreamingServicePreferences;
}

export interface ApiConfiguration {
  collectionId: string;
  userAgent: string;
  useDirectApi: boolean;
  enableCaching: boolean;
  logErrors: boolean;
}

export interface CollectionMetadata {
  collectionName: string;
  lastUpdated?: string;
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
};

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  sortOption: 'artist-asc',
  useGenresOnly: true,
  theme: 'dark',
  showRatings: true,
  ratingDisplayMode: 'average',
  enableLabelFilter: false,
};

export const DEFAULT_STREAMING_PREFERENCES: StreamingPreferences = {
  spotifyUseDesktopApp: false,
  tidalUseDesktopApp: false,
  appleMusicUseDesktopApp: false,
  enabledServices: DEFAULT_STREAMING_SERVICES,
};

export const DEFAULT_API_CONFIGURATION: ApiConfiguration = {
  collectionId: '',
  userAgent: 'MusicLibraryViewer/1.0.0 (mailto:your.email@example.com)',
  useDirectApi: false,
  enableCaching: true,
  logErrors: true,
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
  return ['artist-asc', 'artist-desc', 'title-asc', 'title-desc', 'date-old-new', 'date-new-old'].includes(value);
};

export const isValidThemeOption = (value: string): value is ThemeOption => {
  return ['dark', 'light', 'system'].includes(value);
};