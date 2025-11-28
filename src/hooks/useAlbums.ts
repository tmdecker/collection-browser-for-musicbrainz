import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ReleaseGroup, SortOption } from '@/types/music';
import { fetchReleaseGroup } from '@/utils/api';
import { getBasicData } from '@/utils/progressive-loader';
import { albumMatchesGenreFilters } from '@/utils/genre-processor';
import { albumMatchesLabelFilters } from '@/utils/label-processor';
import { usePreferences } from './usePreferences';

/**
 * @ai-file hook
 * @ai-description Central album data management with IndexedDB caching and AbortController support
 * @ai-dependencies fetchReleaseGroup, getBasicData, usePreferences
 * @ai-features
 * - Album fetching with IndexedDB caching
 * - Album details with request cancellation
 * - Sorting and search functionality
 */

/**
 * Central data management hook - Focused on album data fetching and management
 *
 * @param externalCollectionId - Optional collection ID to override preferences (for direct prop passing)
 * @note Preferences are now managed by the usePreferences hook
 * @returns {Object} Album data, controls, and preference values from usePreferences
 */
export const useAlbums = (externalCollectionId?: string) => {
  const [albums, setAlbums] = useState<ReleaseGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAlbum, setSelectedAlbum] = useState<ReleaseGroup | null>(null);
  const [selectedAlbumDetails, setSelectedAlbumDetails] = useState<ReleaseGroup | null>(null);
  const [selectedAlbumLoading, setSelectedAlbumLoading] = useState<boolean>(false);

  // Ref to store AbortController for cancelling album details fetch
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get preferences from centralized hook
  const {
    preferences,
    setSortOption,
    setUseGenresOnly,
    setSpotifyUseDesktopApp,
    setCollectionName,
    setCollectionId,
  } = usePreferences();

  // Extract commonly used values
  const sortOption = preferences.display.sortOption;
  const useGenresOnly = preferences.display.useGenresOnly;
  const spotifyUseDesktopApp = preferences.streaming.spotifyUseDesktopApp;
  const collectionName = preferences.metadata.collectionName;
  // Use external collection ID if provided, otherwise use preference value
  const collectionId = externalCollectionId ?? preferences.api.collectionId;

  // Note: All preference loading and saving is now handled by usePreferences hook
  // The migration utility will automatically convert old localStorage keys to new format

  // Fetch all albums with covers using the new collection handler
  const fetchAlbums = useCallback(async () => {
    // Check if collection ID is configured
    if (!collectionId) {
      setError('No collection configured.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use the progressive loader for IndexedDB caching
      const data = await getBasicData(collectionId);

      // Verify data integrity before setting state
      if (!Array.isArray(data)) {
        throw new Error('Invalid data returned from collection handler');
      }

      setAlbums(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load albums: ${errorMessage}`);
      setAlbums([]);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  // Fetch detailed information for a specific album
  const fetchAlbumDetails = useCallback(async (albumId: string, signal?: AbortSignal) => {
    if (!albumId) return;

    try {
      // First, check if we already have cached information (basic or detailed)
      const { getReleaseGroup, storeReleaseGroup } = await import('@/utils/db');
      let shouldShowLoading = true;

      try {
        const cachedAlbum = await getReleaseGroup(albumId);
        if (cachedAlbum) {
          // Immediately show the cached data (whether basic or detailed)
          setSelectedAlbumDetails(cachedAlbum);
          shouldShowLoading = false; // Don't show loading since we have cached data

          // Check if this already has detailed data by looking for release details
          const hasDetailedData = cachedAlbum.releases && cachedAlbum.releases.length > 0;

          if (hasDetailedData) {
            // Check if cache is stale (older than 24 hours)
            const cacheAge = Date.now() - (cachedAlbum._cachedAt || 0);
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
            const isStale = cacheAge > TWENTY_FOUR_HOURS;

            if (isStale) {
              console.log(`🕐 Cache stale for ${albumId} (${Math.round(cacheAge / 3600000)}h old), background refresh`);

              // Background refresh (non-blocking, silent)
              fetchReleaseGroup(albumId)
                .then(async (freshDetails) => {
                  // Only update if data changed (compare release count)
                  if (freshDetails.releases?.length !== cachedAlbum.releases?.length) {
                    console.log(`🔄 Background refresh found updated data for ${albumId}`);
                    setSelectedAlbumDetails(freshDetails);
                  }
                  // Always update cache with fresh data
                  const existingAlbum = albums.find(a => a.id === albumId);
                  await storeReleaseGroup({
                    ...freshDetails,
                    cover: existingAlbum?.cover || cachedAlbum.cover || freshDetails.cover
                  });
                })
                .catch(() => {
                  // Silent fail - cached data is still shown
                });
            } else {
              console.log(`✅ Fresh cache for ${albumId} (${Math.round(cacheAge / 3600000)}h old), no refresh`);
            }

            return; // Always return early with cached data
          }
          // Has basic data only - continue to fetch details (with loading=false)
        }
      } catch (err) {
        // Silently continue to fetch from API
      }

      // Check if aborted before continuing
      if (signal?.aborted) {
        return;
      }

      // Only set loading state if we don't have cached data to show
      if (shouldShowLoading) {
        setSelectedAlbumLoading(true);
      }

      // No cached data or only basic data - fetch detailed information
      try {
        const details = await fetchReleaseGroup(albumId, signal);

        // Only update state if not aborted
        if (!signal?.aborted) {
          // Update with detailed information
          setSelectedAlbumDetails(details);

          // Store the detailed information in IndexedDB, preserving existing data like cover URL
          try {
            const existingAlbum = albums.find(a => a.id === albumId);
            const detailsWithCover = {
              ...details,
              // Preserve the cover URL from existing album data
              cover: existingAlbum?.cover || details.cover || `/api/coverart/release-group/${albumId}/front`
            };
            await storeReleaseGroup(detailsWithCover);
          } catch (err) {
            // Silently fail cache storage
          }
        }
      } catch (err) {
        // Don't handle AbortError
        if (err instanceof Error && (err.message === 'AbortError' || err.name === 'AbortError')) {
          return;
        }

        // If we already showed cached basic data, keep showing it
        // If no cached data was available, try to get basic info from memory
        const existingAlbum = albums.find(a => a.id === albumId);
        if (existingAlbum && !selectedAlbumDetails) {
          setSelectedAlbumDetails(existingAlbum);
        } else if (!selectedAlbumDetails) {
          // No fallback available, re-throw the error
          throw err;
        }
        // If selectedAlbumDetails is already set (from cache), just continue
      }
    } catch (err) {
      // Silently handle critical errors
    } finally {
      // Only update loading state if not aborted
      if (!signal?.aborted) {
        setSelectedAlbumLoading(false);
      }
    }
  }, [albums, selectedAlbumDetails]);

  // Handle selecting an album
  const handleSelectAlbum = useCallback((album: ReleaseGroup | null) => {
    // Abort any in-flight album details request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setSelectedAlbum(album);
    if (album) {
      // Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      fetchAlbumDetails(album.id, abortController.signal);
    } else {
      setSelectedAlbumDetails(null);
      abortControllerRef.current = null;
    }
  }, [fetchAlbumDetails]);

  // Sort albums
  const sortAlbums = useCallback((albumsToSort: ReleaseGroup[]) => {
    const sorted = [...albumsToSort];

    switch (sortOption) {
      case 'artist-asc':
        return sorted.sort((a, b) => {
          const artistA = a.artist_credit?.[0]?.artist?.name || '';
          const artistB = b.artist_credit?.[0]?.artist?.name || '';
          return artistA.localeCompare(artistB);
        });
      case 'artist-desc':
        return sorted.sort((a, b) => {
          const artistA = a.artist_credit?.[0]?.artist?.name || '';
          const artistB = b.artist_credit?.[0]?.artist?.name || '';
          return artistB.localeCompare(artistA);
        });
      case 'title-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'date-old-new':
        return sorted.sort((a, b) => {
          const dateA = a.first_release_date || '9999';
          const dateB = b.first_release_date || '9999';
          return dateA.localeCompare(dateB);
        });
      case 'date-new-old':
        return sorted.sort((a, b) => {
          const dateA = a.first_release_date || '0000';
          const dateB = b.first_release_date || '0000';
          return dateB.localeCompare(dateA);
        });
      default:
        return sorted;
    }
  }, [sortOption]);

  // Filtered and sorted albums based on search query only
  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortAlbums(albums);
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = albums.filter(album => {
      // Search by title
      if (album.title.toLowerCase().includes(query)) return true;

      // Search by artist
      const artistMatch = album.artist_credit?.some(credit =>
        credit.artist?.name?.toLowerCase().includes(query)
      );
      if (artistMatch) return true;

      // Search by release date if available
      if (album.first_release_date?.toLowerCase().includes(query)) return true;

      return false;
    });

    return sortAlbums(filtered);
  }, [albums, searchQuery, sortAlbums]);

  // Total albums count (unfiltered)
  const totalAlbums = albums.length;

  // Fetch albums on initial load and when collection changes
  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  // Listen for background refresh completion and update UI
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchAlbums();
    };

    window.addEventListener('mb-data-updated', handleDataUpdated);
    return () => window.removeEventListener('mb-data-updated', handleDataUpdated);
  }, [fetchAlbums]);

  return {
    albums: filteredAlbums,
    rawAlbums: albums, // Unfiltered albums for stats calculation
    totalAlbums,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    selectedAlbum,
    selectedAlbumDetails,
    selectedAlbumLoading,
    handleSelectAlbum,
    refreshAlbums: fetchAlbums,
    collectionName,
    collectionId,
    sortOption,
    setSortOption,
    useGenresOnly,
    setUseGenresOnly,
    spotifyUseDesktopApp,
    preferences
  };
};
