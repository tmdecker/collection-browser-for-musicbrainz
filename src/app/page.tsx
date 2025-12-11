/**
 * @ai-file page
 * @ai-description Main application page integrating all components
 * @ai-dependencies Next.js, React, useAlbums, useFilters, usePreferences, Header, FilterPanel, AlbumGrid, AlbumDetailsPanel
 * @ai-features
 * - Responsive layout with collapsible filter panel and album details panel
 * - Multi-category filtering (genres, tags, labels, dates, ratings)
 * - Album grid with search and sort functionality
 * - Welcome screen with collection input for first-time users
 * - IndexedDB caching with progressive loading
 */

'use client';

// Force dynamic runtime for this page
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useMemo, useCallback, Suspense } from 'react';
import Header, { HeaderRef } from '@/components/Header';
import FilterPanel from '@/components/FilterPanel';
import ActiveFiltersBar from '@/components/ActiveFiltersBar';
import AlbumDetailsPanel from '@/components/AlbumDetailsPanel';
import CollectionBrowsePanel from '@/components/CollectionBrowsePanel';
import LazyAlbumGrid from '@/components/lazy/LazyAlbumGrid';
import { useAlbums } from '@/hooks/useAlbums';
import { useFilters } from '@/hooks/useFilters';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { albumMatchesGenreFilters } from '@/utils/genre-processor';
import { albumMatchesLabelFilters } from '@/utils/label-processor';
import { albumMatchesTagFilters } from '@/utils/tag-processor';
import { albumMatchesDateFilter } from '@/utils/date-processor';
import { validateCollectionId } from '@/utils/mbid-validation';
import { BiCheck, BiError, BiX, BiLinkExternal } from 'react-icons/bi';

export default function Home() {
  // Local state for active collection ID (to trigger useAlbums reload)
  const { preferences: prefs } = usePreferences();
  const [activeCollectionId, setActiveCollectionId] = useState<string | undefined>(undefined);

  // Initialize activeCollectionId from preferences on mount and update when preferences change
  useEffect(() => {
    setActiveCollectionId(prefs.api.collectionId);
  }, [prefs.api.collectionId]); // Update when collection preference changes

  // Album-related state from useAlbums (pass activeCollectionId to enable automatic reload)
  const {
    albums: searchFilteredAlbums,
    rawAlbums,
    totalAlbums,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    selectedAlbum,
    selectedAlbumDetails,
    selectedAlbumLoading,
    handleSelectAlbum,
    refreshAlbums,
    collectionName,
    collectionId,
    sortOption,
    setSortOption,
    useGenresOnly,
    spotifyUseDesktopApp,
    preferences
  } = useAlbums(activeCollectionId);

  // Filter-related state from useFilters (using raw albums for stats)
  const {
    genreStats,
    labelStats,
    tagStats,
    availableYearRange,
    selectedGenres,
    selectedLabels,
    selectedTags,
    releaseDateRange,
    ratingRange,
    toggleGenre,
    toggleLabel,
    toggleTag,
    setReleaseDateRange,
    setRatingRange,
    clearDateFilter,
    clearRatingFilter,
    clearAllGenres,
    clearAllLabels,
    clearAllTags,
    clearAllFilters,
    isFilterPanelOpen,
    setFilterPanelOpen,
    toggleFilterPanel,
    genreSearchQuery,
    setGenreSearchQuery,
    labelSearchQuery,
    setLabelSearchQuery,
    tagSearchQuery,
    setTagSearchQuery,
    hasActiveFilters,
    activeFilterCount
  } = useFilters(rawAlbums);

  // Apply filters to get final album list
  const albums = useMemo(() => {
    let filtered = [...searchFilteredAlbums];

    // Apply genre filters (OR within genres) - always use true for official genres
    if (selectedGenres.length > 0) {
      filtered = filtered.filter(album =>
        albumMatchesGenreFilters(album, selectedGenres, true)
      );
    }

    // Apply label filters (OR within labels)
    if (selectedLabels.length > 0) {
      filtered = filtered.filter(album =>
        albumMatchesLabelFilters(album, selectedLabels)
      );
    }

    // Apply tag filters (OR within tags)
    if (selectedTags.length > 0) {
      filtered = filtered.filter(album =>
        albumMatchesTagFilters(album, selectedTags)
      );
    }

    // Apply date range filter
    if (releaseDateRange && availableYearRange &&
        (releaseDateRange.min !== availableYearRange.min ||
         releaseDateRange.max !== availableYearRange.max)) {
      filtered = filtered.filter(album =>
        albumMatchesDateFilter(album, releaseDateRange.min, releaseDateRange.max)
      );
    }

    // Apply rating filter (always uses average rating)
    if (ratingRange) {
      filtered = filtered.filter(album => {
        const stars = album.rating?.average ?? null;
        if (stars === null) return false; // Exclude albums without ratings
        return stars >= ratingRange.min && stars <= ratingRange.max;
      });
    }

    return filtered;
  }, [searchFilteredAlbums, selectedGenres, selectedLabels, selectedTags, releaseDateRange, ratingRange, availableYearRange]);

  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [collectionsPanelOpen, setCollectionsPanelOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const headerRef = useRef<HeaderRef>(null);

  // Get auth state for collections panel
  const { isAuthenticated, user, login } = useAuth();
  const { updateApi, updateMetadata } = usePreferences();

  // State for manual collection input on welcome screen
  const [manualCollectionId, setManualCollectionId] = useState('');
  const [validationState, setValidationState] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const skipValidationRef = useRef(false);

  // Open details panel when an album is selected and close other panels
  useEffect(() => {
    if (selectedAlbum) {
      setDetailsPanelOpen(true);
      // Close other panels when opening album details
      setFilterPanelOpen(false);
      setCollectionsPanelOpen(false);
    }
  }, [selectedAlbum, setFilterPanelOpen]);

  // Handle close details panel
  const handleCloseDetailsPanel = () => {
    setDetailsPanelOpen(false);
    handleSelectAlbum(null);
  };

  // Enhanced filter panel toggle that closes other panels when opening
  const handleToggleFilterPanel = () => {
    const newFilterPanelState = !isFilterPanelOpen;

    // If opening filter panel, close other panels
    if (newFilterPanelState) {
      setDetailsPanelOpen(false);
      handleSelectAlbum(null);
      setCollectionsPanelOpen(false);
    }

    // Toggle the filter panel
    toggleFilterPanel();
  };

  // Enhanced collections panel toggle that closes other panels when opening
  const handleToggleCollectionsPanel = () => {
    const newCollectionsPanelState = !collectionsPanelOpen;

    // If opening collections panel, close other panels
    if (newCollectionsPanelState) {
      setDetailsPanelOpen(false);
      handleSelectAlbum(null);
      setFilterPanelOpen(false);
    }

    // Toggle the collections panel
    setCollectionsPanelOpen(newCollectionsPanelState);
  };

  // Debounced validation function for manual collection input on welcome screen
  const validateManualCollection = useCallback(async (input: string) => {
    if (!input.trim()) {
      setValidationState({ status: 'idle', message: '' });
      return;
    }

    setValidationState({ status: 'validating', message: 'Validating...' });

    const result = await validateCollectionId(input);

    if (result.valid && result.mbid) {
      setValidationState({ status: 'valid', message: result.message });

      // Auto-update the input field with the extracted MBID if user entered a URL
      if (result.mbid !== input.trim()) {
        skipValidationRef.current = true; // Skip validation on the next update
        setManualCollectionId(result.mbid);
      }

      // Auto-clear success toast after 3 seconds (but keep the valid state)
      setTimeout(() => {
        setValidationState(prev => prev.status === 'valid' ? { ...prev, message: '' } : prev);
      }, 3000);
    } else {
      setValidationState({ status: 'error', message: result.message });

      // Auto-clear error message after 5 seconds
      setTimeout(() => {
        setValidationState(prev => prev.status === 'error' ? { status: 'idle', message: '' } : prev);
      }, 5000);
    }
  }, []);

  // Debounce timer for manual input validation
  useEffect(() => {
    // Skip validation if we're just updating with extracted MBID
    if (skipValidationRef.current) {
      skipValidationRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      validateManualCollection(manualCollectionId);
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timer);
  }, [manualCollectionId, validateManualCollection]);

  // Handle loading manual collection from welcome screen
  const handleLoadManualCollection = () => {
    if (validationState.status === 'valid' && manualCollectionId.trim()) {
      handleLoadCollection(manualCollectionId.trim(), 'Manual Collection');
      setManualCollectionId('');
      setValidationState({ status: 'idle', message: '' });
    }
  };

  // Handle loading a new collection
  const handleLoadCollection = (newCollectionId: string, collectionName: string) => {
    // Update preferences (for persistence)
    updateApi({ collectionId: newCollectionId });
    updateMetadata({ collectionName });

    // Update local state to trigger automatic reload via useAlbums
    setActiveCollectionId(newCollectionId);
  };

  // Handle manual refresh of current collection
  const handleRefreshCollection = async () => {
    if (!collectionId || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const { forceRefreshCollection } = await import('@/utils/progressive-loader');
      await forceRefreshCollection(collectionId);

      // Trigger UI refresh
      refreshAlbums();
    } catch (error) {
      console.error('Failed to refresh collection:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle title click - close all panels and scroll to top
  const handleTitleClick = () => {
    // Close all panels
    setDetailsPanelOpen(false);
    handleSelectAlbum(null);
    setFilterPanelOpen(false);
    setCollectionsPanelOpen(false);

    // Close sort dropdown
    headerRef.current?.closeSortDropdown();

    // Clear search bar
    setSearchQuery('');

    // Scroll to top with smooth animation
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="flex min-h-screen flex-col">
      <Suspense fallback={
        <div className="h-16 bg-background-secondary border-b border-background-tertiary" />
      }>
        <Header
          ref={headerRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          totalAlbums={loading ? 'Loading...' : totalAlbums}
          filteredAlbums={albums.length}
          collectionName={collectionName}
          collectionId={collectionId}
          sortOption={sortOption}
          setSortOption={setSortOption}
          isFilterPanelOpen={isFilterPanelOpen}
          toggleFilterPanel={handleToggleFilterPanel}
          activeFilterCount={activeFilterCount}
          hasActiveFilters={hasActiveFilters}
          isCollectionsPanelOpen={collectionsPanelOpen}
          toggleCollectionsPanel={handleToggleCollectionsPanel}
          onTitleClick={handleTitleClick}
        />
      </Suspense>

      {/* Active Filters Bar - Always visible when filters are active */}
      <ActiveFiltersBar
        selectedGenres={selectedGenres}
        selectedLabels={selectedLabels}
        selectedTags={selectedTags}
        releaseDateRange={releaseDateRange}
        availableYearRange={availableYearRange}
        ratingRange={ratingRange}
        onToggleGenre={toggleGenre}
        onToggleLabel={toggleLabel}
        onToggleTag={toggleTag}
        onClearDateFilter={clearDateFilter}
        onClearRatingFilter={clearRatingFilter}
        onClearAll={clearAllFilters}
        isFilterPanelOpen={isFilterPanelOpen}
      />

      {/* Filter Panel */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        genreStats={genreStats}
        labelStats={labelStats}
        tagStats={tagStats}
        availableYearRange={availableYearRange}
        selectedGenres={selectedGenres}
        selectedLabels={selectedLabels}
        selectedTags={selectedTags}
        releaseDateRange={releaseDateRange}
        ratingRange={ratingRange}
        genreSearchQuery={genreSearchQuery}
        labelSearchQuery={labelSearchQuery}
        tagSearchQuery={tagSearchQuery}
        enableLabelFilter={prefs.display.enableLabelFilter}
        onGenreSearchChange={setGenreSearchQuery}
        onLabelSearchChange={setLabelSearchQuery}
        onTagSearchChange={setTagSearchQuery}
        onToggleGenre={toggleGenre}
        onToggleLabel={toggleLabel}
        onToggleTag={toggleTag}
        onReleaseDateRangeChange={setReleaseDateRange}
        onRatingRangeChange={setRatingRange}
        onClearAll={clearAllFilters}
        onClose={() => setFilterPanelOpen(false)}
      />

      {/* Album Details Panel */}
      <AlbumDetailsPanel
        album={selectedAlbum}
        albumDetails={selectedAlbumDetails}
        loading={selectedAlbumLoading}
        isOpen={detailsPanelOpen}
        onClose={handleCloseDetailsPanel}
        useGenresOnly={useGenresOnly}
        onToggleGenre={toggleGenre}
        onToggleLabel={prefs.display.enableLabelFilter ? toggleLabel : undefined}
        selectedGenres={selectedGenres}
        selectedLabels={prefs.display.enableLabelFilter ? selectedLabels : []}
        hasActiveFilters={hasActiveFilters || isFilterPanelOpen}
        spotifyUseDesktopApp={spotifyUseDesktopApp}
        tidalUseDesktopApp={preferences.streaming.tidalUseDesktopApp}
        appleMusicUseDesktopApp={preferences.streaming.appleMusicUseDesktopApp}
        enabledStreamingServices={preferences.streaming.enabledServices}
        showRatings={preferences.display.showRatings}
        ratingDisplayMode={preferences.display.ratingDisplayMode}
        isAuthenticated={isAuthenticated}
      />

      {/* Collections Browse Panel */}
      <CollectionBrowsePanel
        isOpen={collectionsPanelOpen}
        onClose={() => setCollectionsPanelOpen(false)}
        username={user?.name || null}
        currentCollectionId={collectionId}
        onLoadCollection={handleLoadCollection}
        isAuthenticated={isAuthenticated}
        hasActiveFilters={hasActiveFilters || isFilterPanelOpen}
        onLogin={login}
        onRefreshCollection={handleRefreshCollection}
        isRefreshing={isRefreshing}
      />

      {/* Validation Toast Notification */}
      {validationState.message && validationState.status !== 'idle' && validationState.status !== 'validating' && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`px-4 py-3 rounded-lg shadow-lg backdrop-blur-md border ${
            validationState.status === 'valid'
              ? 'bg-green-900/90 text-green-100 border-green-500/30'
              : 'bg-red-900/90 text-red-100 border-red-500/30'
          }`}>
            <div className="flex items-center space-x-2">
              {validationState.status === 'valid' && (
                <BiCheck className="flex-shrink-0" size={20} />
              )}
              {validationState.status === 'error' && (
                <BiError className="flex-shrink-0" size={20} />
              )}
              <span className="text-sm font-medium">{validationState.message}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-6">
          <div className="p-4 bg-background-tertiary border border-background-secondary rounded-md">
            <h2 className="text-lg font-medium mb-2 text-primary">
              {error.includes('No collection configured') ? 'Welcome to Music Library Viewer' : error.includes('Using sample data') ? 'Notice' : 'Error'}
            </h2>
            <p className="text-text-secondary">{error}</p>
            {error.includes('No collection configured') && (
              <div className="mt-4 space-y-6">
                <div>
                  <p className="text-text-secondary mb-4">
                    Enter a MusicBrainz collection ID or URL to get started. Works with any public collection!
                  </p>

                  {/* Collection Input Field */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-2xl">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={manualCollectionId}
                        onChange={(e) => setManualCollectionId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && validationState.status === 'valid') {
                            handleLoadManualCollection();
                          }
                        }}
                        placeholder="Enter collection ID or URL"
                        className="w-full px-3 py-2 pr-10 bg-[#2A2A2A] text-text-primary text-sm rounded-lg border border-white/10 focus:border-primary focus:outline-none placeholder:text-white/40"
                      />

                      {/* Clear button */}
                      {manualCollectionId && (
                        <button
                          onClick={() => {
                            skipValidationRef.current = false;
                            setManualCollectionId('');
                            setValidationState({ status: 'idle', message: '' });
                          }}
                          className="absolute right-10 top-1/2 -translate-y-1/2 p-1 transition-colors group"
                          aria-label="Clear input"
                        >
                          <BiX className="w-5 h-5 text-white/60 group-hover:text-white/90 transition-colors" />
                        </button>
                      )}

                      {/* Validation status icon */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                        {validationState.status === 'valid' && (
                          <BiCheck className="w-5 h-5 text-green-500" />
                        )}
                        {validationState.status === 'error' && (
                          <BiError className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    </div>

                    {/* Load Button */}
                    {validationState.status === 'valid' && (
                      <button
                        onClick={handleLoadManualCollection}
                        className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors whitespace-nowrap"
                      >
                        Load Collection
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-text-tertiary mt-2">
                    Example: https://musicbrainz.org/collection/YOUR-COLLECTION-ID
                  </p>
                </div>

                {/* Login Option */}
                <div className="pt-4 border-t border-white/10">
                  <p className="text-text-secondary mb-3">
                    Or login to browse your personal collections
                  </p>
                  <button
                    onClick={login}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
                  >
                    Login with MusicBrainz
                    <BiLinkExternal size={14} />
                  </button>
                </div>
              </div>
            )}
            {error.includes('Using sample data') && (
              <div className="mt-4">
                <p className="text-text-secondary">You're seeing sample album data because we couldn't connect to MusicBrainz.</p>
                <p className="text-text-secondary mt-2">Visit <a href="/debug" className="text-primary hover:underline">the debug page</a> to troubleshoot.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1">
        <LazyAlbumGrid
          albums={albums}
          selectedAlbum={selectedAlbum}
          onSelectAlbum={handleSelectAlbum}
          loading={loading}
        />
      </div>
    </main>
  );
}
