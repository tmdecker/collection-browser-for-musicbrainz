/**
 * @ai-file hook
 * @ai-description Centralized preference management with localStorage persistence and automatic migration
 * @ai-dependencies React hooks, UserPreferences types, preference-migration utilities
 * @ai-features
 * - Single source of truth for all user preferences (display, streaming, API, metadata, auth)
 * - Type-safe preference updates with granular setters
 * - Automatic localStorage persistence
 * - Automatic migration from legacy keys (mbConfigOptions, sortOption, etc.)
 * - Import/export functionality
 */

import { useState, useEffect, useCallback } from 'react';
import {
  UserPreferences,
  DisplayPreferences,
  StreamingPreferences,
  ApiConfiguration,
  CollectionMetadata,
  AuthPreferences,
  DEFAULT_USER_PREFERENCES,
  PreferenceCategory,
  PartialPreferences,
  StreamingServicePreferences,
  RatingDisplayMode,
} from '@/types/preferences';
import {
  loadPreferences,
  savePreferences,
  cleanupLegacyKeys,
  exportPreferences as exportPrefs,
  importPreferences as importPrefs,
} from '@/utils/preference-migration';

interface UsePreferencesReturn {
  // Current preferences
  preferences: UserPreferences;

  // Category-specific updaters
  updateDisplay: (updates: PartialPreferences<'display'>) => void;
  updateStreaming: (updates: PartialPreferences<'streaming'>) => void;
  updateApi: (updates: PartialPreferences<'api'>) => void;
  updateMetadata: (updates: PartialPreferences<'metadata'>) => void;
  updateAuth: (updates: PartialPreferences<'auth'>) => void;

  // Convenience updaters for common operations
  setSortOption: (sortOption: DisplayPreferences['sortOption']) => void;
  setUseGenresOnly: (useGenresOnly: boolean) => void;
  setEnableLabelFilter: (enableLabelFilter: boolean) => void;
  setSpotifyUseDesktopApp: (useDesktopApp: boolean) => void;
  setTidalUseDesktopApp: (useDesktopApp: boolean) => void;
  setAppleMusicUseDesktopApp: (useDesktopApp: boolean) => void;
  setEnabledStreamingServices: (services: Partial<StreamingServicePreferences>) => void;
  setCollectionId: (collectionId: string) => void;
  setCollectionName: (collectionName: string) => void;
  setShowRatings: (show: boolean) => void;
  setRatingDisplayMode: (mode: RatingDisplayMode) => void;
  toggleShowRatings: () => void;

  // Utility functions
  resetToDefaults: () => void;
  exportPreferences: () => string;
  importPreferences: (json: string) => boolean;
  cleanupLegacyStorage: () => void;
}

export const usePreferences = (): UsePreferencesReturn => {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const loadedPreferences = loadPreferences();
    setPreferences(loadedPreferences);
    setIsInitialized(true);
  }, []);

  // Listen for external localStorage changes (e.g., from progressive loader, other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent | CustomEvent) => {
      // Handle both native storage events and custom events
      if (e instanceof StorageEvent) {
        if (e.key === 'mb-user-preferences' && e.newValue) {
          const updatedPreferences = loadPreferences();
          setPreferences(updatedPreferences);
        }
      } else if (e.type === 'mb-preferences-updated') {
        // Custom event from progressive loader
        const updatedPreferences = loadPreferences();
        setPreferences(updatedPreferences);
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange as EventListener);
    // Listen for custom events (from progressive loader only)
    window.addEventListener('mb-preferences-updated', handleStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange as EventListener);
      window.removeEventListener('mb-preferences-updated', handleStorageChange as EventListener);
    };
  }, []);

  // Save preferences to localStorage whenever they change (after initialization)
  useEffect(() => {
    if (isInitialized) {
      savePreferences(preferences);
    }
  }, [preferences, isInitialized]);

  // Generic updater for preference categories
  const updatePreferenceCategory = useCallback(
    <T extends PreferenceCategory>(category: T, updates: PartialPreferences<T>) => {
      setPreferences(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          ...updates,
        },
      }));
    },
    []
  );

  // Category-specific updaters
  const updateDisplay = useCallback(
    (updates: PartialPreferences<'display'>) => {
      updatePreferenceCategory('display', updates);
    },
    [updatePreferenceCategory]
  );

  const updateStreaming = useCallback(
    (updates: PartialPreferences<'streaming'>) => {
      updatePreferenceCategory('streaming', updates);
    },
    [updatePreferenceCategory]
  );

  const updateApi = useCallback(
    (updates: PartialPreferences<'api'>) => {
      // If collection ID is being changed, clear the collection name
      if (updates.collectionId !== undefined && updates.collectionId !== preferences.api.collectionId) {
        // Clear collection name first
        setPreferences(prev => ({
          ...prev,
          metadata: {
            ...prev.metadata,
            collectionName: ''
          },
          api: {
            ...prev.api,
            ...updates
          }
        }));
      } else {
        updatePreferenceCategory('api', updates);
      }
    },
    [updatePreferenceCategory, preferences.api.collectionId]
  );

  const updateMetadata = useCallback(
    (updates: PartialPreferences<'metadata'>) => {
      updatePreferenceCategory('metadata', updates);
    },
    [updatePreferenceCategory]
  );

  const updateAuth = useCallback(
    (updates: PartialPreferences<'auth'>) => {
      updatePreferenceCategory('auth', updates);
    },
    [updatePreferenceCategory]
  );

  // Convenience updaters for frequently used preferences
  const setSortOption = useCallback(
    (sortOption: DisplayPreferences['sortOption']) => {
      updateDisplay({ sortOption });
    },
    [updateDisplay]
  );

  const setUseGenresOnly = useCallback(
    (useGenresOnly: boolean) => {
      updateDisplay({ useGenresOnly });
    },
    [updateDisplay]
  );

  const setEnableLabelFilter = useCallback(
    (enableLabelFilter: boolean) => {
      updateDisplay({ enableLabelFilter });
    },
    [updateDisplay]
  );

  const setSpotifyUseDesktopApp = useCallback(
    (spotifyUseDesktopApp: boolean) => {
      updateStreaming({ spotifyUseDesktopApp });
    },
    [updateStreaming]
  );

  const setTidalUseDesktopApp = useCallback(
    (tidalUseDesktopApp: boolean) => {
      updateStreaming({ tidalUseDesktopApp });
    },
    [updateStreaming]
  );

  const setAppleMusicUseDesktopApp = useCallback(
    (appleMusicUseDesktopApp: boolean) => {
      updateStreaming({ appleMusicUseDesktopApp });
    },
    [updateStreaming]
  );

  const setEnabledStreamingServices = useCallback(
    (services: Partial<StreamingServicePreferences>) => {
      updateStreaming({
        enabledServices: {
          ...preferences.streaming.enabledServices,
          ...services,
        },
      });
    },
    [preferences.streaming.enabledServices, updateStreaming]
  );

  const setCollectionId = useCallback(
    (collectionId: string) => {
      // When changing collection ID, clear the collection name
      // so it will be fetched fresh for the new collection
      if (collectionId !== preferences.api.collectionId) {
        console.log(`🔄 Collection ID changed from "${preferences.api.collectionId}" to "${collectionId}", clearing collection name`);
        updateMetadata({ collectionName: '' });
      }
      updateApi({ collectionId });
    },
    [updateApi, updateMetadata, preferences.api.collectionId]
  );

  const setCollectionName = useCallback(
    (collectionName: string) => {
      updateMetadata({ collectionName });
    },
    [updateMetadata]
  );

  const setShowRatings = useCallback(
    (showRatings: boolean) => {
      updateDisplay({ showRatings });
    },
    [updateDisplay]
  );

  const setRatingDisplayMode = useCallback(
    (ratingDisplayMode: RatingDisplayMode) => {
      updateDisplay({ ratingDisplayMode });
    },
    [updateDisplay]
  );

  const toggleShowRatings = useCallback(() => {
    updateDisplay({ showRatings: !preferences.display.showRatings });
  }, [preferences.display.showRatings, updateDisplay]);

  // Utility functions
  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_USER_PREFERENCES);
  }, []);

  const exportPreferences = useCallback(() => {
    return exportPrefs();
  }, []);

  const importPreferences = useCallback((json: string) => {
    const success = importPrefs(json);
    if (success) {
      // Reload preferences after successful import
      const loadedPreferences = loadPreferences();
      setPreferences(loadedPreferences);
    }
    return success;
  }, []);

  const cleanupLegacyStorage = useCallback(() => {
    cleanupLegacyKeys();
  }, []);

  return {
    preferences,
    updateDisplay,
    updateStreaming,
    updateApi,
    updateMetadata,
    updateAuth,
    setSortOption,
    setUseGenresOnly,
    setEnableLabelFilter,
    setSpotifyUseDesktopApp,
    setTidalUseDesktopApp,
    setAppleMusicUseDesktopApp,
    setEnabledStreamingServices,
    setCollectionId,
    setCollectionName,
    setShowRatings,
    setRatingDisplayMode,
    toggleShowRatings,
    resetToDefaults,
    exportPreferences,
    importPreferences,
    cleanupLegacyStorage,
  };
};