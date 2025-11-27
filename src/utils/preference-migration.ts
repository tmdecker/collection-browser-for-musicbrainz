/**
 * @ai-file utility
 * @ai-description Migration utilities for converting old localStorage preferences to new structure
 * @ai-dependencies UserPreferences types
 * @ai-features
 * - Automatic migration from scattered localStorage keys (mbConfigOptions, sortOption, etc.)
 * - Safe type conversion and validation
 * - Cleanup of old localStorage keys
 * - Version management for future migrations
 */

import {
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
  SortOption,
  isValidSortOption,
} from '@/types/preferences';

// Old localStorage keys that need migration
const OLD_STORAGE_KEYS = {
  CONFIG: 'mbConfigOptions',
  SORT: 'sortOption',
  GENRES_ONLY: 'useGenresOnly',
  SPOTIFY_DESKTOP: 'spotifyUseDesktopApp',
  COLLECTION_NAME: 'collectionName',
} as const;

// New storage key
export const PREFERENCES_STORAGE_KEY = 'mb-user-preferences';

interface LegacyConfig {
  collectionId?: string;
}

/**
 * Migrates old localStorage preferences to new structure
 */
export const migratePreferences = (): UserPreferences => {
  try {
    // Start with default preferences
    let preferences: UserPreferences = { ...DEFAULT_USER_PREFERENCES };

    // Migrate mbConfigOptions
    const savedConfig = localStorage.getItem(OLD_STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      try {
        const config: LegacyConfig = JSON.parse(savedConfig);
        preferences.api = {
          ...preferences.api,
          collectionId: config.collectionId || preferences.api.collectionId,
        };
      } catch (e) {
        console.warn('Failed to migrate mbConfigOptions:', e);
      }
    }

    // Migrate sort option
    const savedSort = localStorage.getItem(OLD_STORAGE_KEYS.SORT);
    if (savedSort && isValidSortOption(savedSort)) {
      preferences.display.sortOption = savedSort;
    }

    // Migrate useGenresOnly
    const savedGenresOnly = localStorage.getItem(OLD_STORAGE_KEYS.GENRES_ONLY);
    if (savedGenresOnly) {
      preferences.display.useGenresOnly = savedGenresOnly === 'true';
    }

    // Migrate Spotify desktop preference
    const savedSpotifyDesktop = localStorage.getItem(OLD_STORAGE_KEYS.SPOTIFY_DESKTOP);
    if (savedSpotifyDesktop) {
      preferences.streaming.spotifyUseDesktopApp = savedSpotifyDesktop === 'true';
    }

    // Migrate collection name
    const savedCollectionName = localStorage.getItem(OLD_STORAGE_KEYS.COLLECTION_NAME);
    if (savedCollectionName) {
      preferences.metadata.collectionName = savedCollectionName;
    }

    return preferences;
  } catch (error) {
    console.error('Error during preference migration:', error);
    return DEFAULT_USER_PREFERENCES;
  }
};

/**
 * Loads preferences from localStorage, with automatic migration if needed
 */
export const loadPreferences = (): UserPreferences => {
  try {
    // Check if new preferences already exist
    const savedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);

    if (savedPreferences) {
      const parsed: UserPreferences = JSON.parse(savedPreferences);

      // Validate version and structure
      if (parsed.version === DEFAULT_USER_PREFERENCES.version) {
        // Merge with defaults to ensure new properties are present
        // This is important for when new fields are added to existing preference categories
        return {
          ...DEFAULT_USER_PREFERENCES,
          ...parsed,
          display: { ...DEFAULT_USER_PREFERENCES.display, ...parsed.display },
          streaming: {
            ...DEFAULT_USER_PREFERENCES.streaming,
            ...parsed.streaming,
            // Ensure new desktop app preferences are included with defaults
            spotifyUseDesktopApp: parsed.streaming?.spotifyUseDesktopApp ?? DEFAULT_USER_PREFERENCES.streaming.spotifyUseDesktopApp,
            tidalUseDesktopApp: parsed.streaming?.tidalUseDesktopApp ?? DEFAULT_USER_PREFERENCES.streaming.tidalUseDesktopApp,
            appleMusicUseDesktopApp: parsed.streaming?.appleMusicUseDesktopApp ?? DEFAULT_USER_PREFERENCES.streaming.appleMusicUseDesktopApp,
            enabledServices: {
              ...DEFAULT_USER_PREFERENCES.streaming.enabledServices,
              ...parsed.streaming?.enabledServices,
            },
          },
          api: { ...DEFAULT_USER_PREFERENCES.api, ...parsed.api },
          metadata: { ...DEFAULT_USER_PREFERENCES.metadata, ...parsed.metadata },
        };
      }
    }

    // No new preferences found, attempt migration
    console.log('Migrating legacy preferences to new structure...');
    const migratedPreferences = migratePreferences();

    // Save migrated preferences
    savePreferences(migratedPreferences);

    return migratedPreferences;
  } catch (error) {
    console.error('Error loading preferences:', error);
    return DEFAULT_USER_PREFERENCES;
  }
};

/**
 * Saves preferences to localStorage
 */
export const savePreferences = (preferences: UserPreferences): void => {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
};

/**
 * Cleans up old localStorage keys after successful migration
 * Call this after confirming the new preferences are working correctly
 */
export const cleanupLegacyKeys = (): void => {
  try {
    Object.values(OLD_STORAGE_KEYS).forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`Removing legacy preference key: ${key}`);
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error cleaning up legacy keys:', error);
  }
};

/**
 * Validates preference structure for debugging
 */
export const validatePreferences = (preferences: UserPreferences): boolean => {
  try {
    return (
      typeof preferences === 'object' &&
      preferences.version === DEFAULT_USER_PREFERENCES.version &&
      typeof preferences.display === 'object' &&
      typeof preferences.streaming === 'object' &&
      typeof preferences.api === 'object' &&
      typeof preferences.metadata === 'object'
    );
  } catch (error) {
    return false;
  }
};

/**
 * Exports current preferences for backup/debugging
 */
export const exportPreferences = (): string => {
  const preferences = loadPreferences();
  return JSON.stringify(preferences, null, 2);
};

/**
 * Imports preferences from JSON string
 */
export const importPreferences = (json: string): boolean => {
  try {
    const preferences: UserPreferences = JSON.parse(json);
    if (validatePreferences(preferences)) {
      savePreferences(preferences);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error importing preferences:', error);
    return false;
  }
};