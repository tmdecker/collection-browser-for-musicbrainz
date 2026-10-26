import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ReleaseGroup, SortOption } from '@/types/music';
import { getBasicData } from '@/utils/progressive-loader';
import { albumMatchesGenreFilters } from '@/utils/genre-processor';
import { albumMatchesLabelFilters } from '@/utils/label-processor';
import { usePreferences } from './usePreferences';
import { normalizeReleaseGroup } from '@/utils/normalize-mb-data';
import { bumpCoverVersion } from '@/utils/cover-versions';

/**
 * @ai-file hook
 * @ai-description Central album data management with IndexedDB caching and server-side cache integration
 * @ai-dependencies getBasicData, usePreferences, /api/release-groups/[mbid]
 * @ai-features
 * - Album fetching with IndexedDB caching
 * - Album details with server-side cache and request cancellation
 * - Manual refresh of one album from MusicBrainz (after editing it there)
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

  // The selected album for callbacks that finish later (manual refresh)
  const selectedAlbumRef = useRef<ReleaseGroup | null>(null);
  useEffect(() => {
    selectedAlbumRef.current = selectedAlbum;
  }, [selectedAlbum]);

  // Ref to store AbortController for cancelling album details fetch
  const abortControllerRef = useRef<AbortController | null>(null);
  // Increments with every collection load; results of older loads are ignored (fast collection switches)
  const loadIdRef = useRef(0);

  // Get preferences from centralized hook
  const {
    preferences,
    setSortOption,
    setUseGenresOnly,
    setSpotifyUseDesktopApp,
    setCollectionName,
    setCollectionId,
  } = usePreferences();

  // Read by the prefetch request; a ref, so changing the country does not reload the collection
  const streamingCountryRef = useRef(preferences.streaming.country);
  useEffect(() => {
    streamingCountryRef.current = preferences.streaming.country;
  }, [preferences.streaming.country]);

  // Extract commonly used values
  const sortOption = preferences.display.sortOption;
  const useGenresOnly = preferences.display.useGenresOnly;
  const spotifyUseDesktopApp = preferences.streaming.spotifyUseDesktopApp;
  const collectionName = preferences.metadata.collectionName;
  const entityType = preferences.metadata.entityType;
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

    const loadId = ++loadIdRef.current;
    const isCurrentLoad = () => loadId === loadIdRef.current;

    try {
      setLoading(true);
      setError(null);

      // Use the progressive loader for IndexedDB caching
      const data = await getBasicData(collectionId, entityType);

      // Another collection was selected meanwhile: drop this result instead of overwriting the new one
      if (!isCurrentLoad()) return;

      // Verify data integrity before setting state
      if (!Array.isArray(data)) {
        throw new Error('Invalid data returned from collection handler');
      }

      setAlbums(data);

      // Trigger background prefetch for all album details
      if (data.length > 0) {
        fetch('/api/prefetch/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rgMbids: data.map(a => a.id), country: streamingCountryRef.current })
        }).catch(() => {}); // Fire and forget
      }
    } catch (err) {
      if (!isCurrentLoad()) return;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load albums: ${errorMessage}`);
      setAlbums([]);
    } finally {
      if (isCurrentLoad()) {
        setLoading(false);
      }
    }
  }, [collectionId, entityType]);

  // Fetch detailed information for a specific album
  const fetchAlbumDetails = useCallback(async (albumId: string, signal?: AbortSignal) => {
    if (!albumId) return;

    try {
      // First, check if we already have cached information (basic or detailed)
      const { getReleaseGroup, storeReleaseGroup } = await import('@/utils/db');
      let shouldShowLoading = true;

      try {
        const cachedAlbum = await getReleaseGroup(albumId);
        // The user may have picked another album while IndexedDB was read
        if (signal?.aborted) return;
        if (cachedAlbum) {
          // Immediately show the cached data (whether basic or detailed)
          setSelectedAlbumDetails(cachedAlbum);
          shouldShowLoading = false; // Don't show loading since we have cached data

          // Check if this already has detailed data by looking for release details;
          // releases cached before browsing included url-rels have no relations and are fetched again
          const hasDetailedData = cachedAlbum.releases && cachedAlbum.releases.length > 0
            && cachedAlbum.releases.every(release => release.relations);

          if (hasDetailedData) {
            // Check if cache is stale (older than 24 hours)
            const cacheAge = Date.now() - (cachedAlbum._cachedAt || 0);
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
            const isStale = cacheAge > TWENTY_FOUR_HOURS;

            if (isStale) {
              console.log(`🕐 Cache stale for ${albumId} (${Math.round(cacheAge / 3600000)}h old), background refresh`);

              // Background refresh (non-blocking, silent)
              fetch(`/api/release-groups/${albumId}`)
                .then(res => res.json())
                .then(async (json) => {
                  if (!json.success) return;
                  const freshDetails = json.data;

                  // Only update if data changed (compare release count) and this album is still selected
                  if (!signal?.aborted && freshDetails.releases?.length !== cachedAlbum.releases?.length) {
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
        const response = await fetch(`/api/release-groups/${albumId}`, { signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (!json.success) throw new Error(json.error || 'Failed to fetch');
        const details = json.data;

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

  // Fetch one album from MusicBrainz again, bypassing every cache (after editing it on MusicBrainz)
  const refreshAlbum = useCallback(async (albumId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/release-groups/${albumId}`, { method: 'POST' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || `HTTP ${response.status}`);
      const details = json.data;

      // The server dropped its cover images: load the cover again instead of the browser's copy
      bumpCoverVersion(albumId);

      // Still selected: show the new data (new releaseDetails make the panel ask for streaming links again)
      if (selectedAlbumRef.current?.id === albumId) {
        setSelectedAlbumDetails(details);
      }

      // Grid entry: new title, genres, tags and rating; the personal rating only comes with the collection
      const fresh = normalizeReleaseGroup(details);
      setAlbums(prev => prev.map(album => album.id !== albumId ? album : {
        ...album,
        title: fresh.title,
        artist_credit: fresh.artist_credit,
        first_release_date: fresh.first_release_date,
        primary_type: fresh.primary_type,
        secondary_types: fresh.secondary_types,
        genres: fresh.genres,
        tags: fresh.tags,
        rating: fresh.rating ? { ...fresh.rating, personal: album.rating?.personal ?? null } : album.rating,
      }));

      const { storeReleaseGroup } = await import('@/utils/db');
      await storeReleaseGroup({ ...details, cover: details.cover || `/api/coverart/release-group/${albumId}/front` });
      return true;
    } catch (err) {
      console.warn(`❌ Refresh of album ${albumId} failed:`, err);
      return false;
    }
  }, []);

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
      case 'series-order':
        return sorted.sort((a, b) => {
          const orderA = a.seriesOrder ?? 999;
          const orderB = b.seriesOrder ?? 999;
          return orderA - orderB;
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
    // Data fetching: fetchAlbums sets loading state right away, then loads asynchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    refreshAlbum,
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
