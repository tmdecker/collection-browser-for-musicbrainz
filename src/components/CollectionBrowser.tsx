/**
 * @ai-file component
 * @ai-description Collection browser screen integrating all components; rendered by the /collection/[mbid] and /series/[mbid] routes
 * @ai-dependencies Next.js, React, useAlbums, useFilters, usePreferences, Header, FilterPanel, LazyAlbumGrid, AlbumDetailsPanel
 * @ai-features
 * - Responsive layout with collapsible filter panel and album details panel
 * - Multi-category filtering (genres, tags, labels, dates, ratings)
 * - Album grid with search and sort functionality
 * - IndexedDB caching with progressive loading
 * - The collection or series to show comes from the URL; the last one opened is remembered in preferences
 * - The open album is part of the address (?album=): Back closes it, a reload or a shared link opens it again
 * - Arrow keys and (phones) a sideways swipe on the panel step to the previous or next album in the grid
 * - Filters are kept per collection or series; the tab title names the collection and the open album
 */

'use client';

import { useEffect, useState, useRef, useMemo, useCallback, Suspense } from 'react';
import Header, { HeaderRef } from '@/components/Header';
import CollectionFootnote from '@/components/CollectionFootnote';
import FilterPanel from '@/components/FilterPanel';
import ActiveFiltersBar from '@/components/ActiveFiltersBar';
import AlbumDetailsPanel from '@/components/AlbumDetailsPanel';
import LazyAlbumGrid from '@/components/lazy/LazyAlbumGrid';
import { useAlbums } from '@/hooks/useAlbums';
import { useFilters } from '@/hooks/useFilters';
import { useSeriesHomepage } from '@/hooks/useSeriesHomepage';
import { useAuth } from '@/hooks/useAuth';
import PageTitle from '@/components/PageTitle';
import { usePreferences } from '@/hooks/usePreferences';
import { ReleaseGroup } from '@/types/music';
import { albumMatchesSelection, facetedStats, type FilterSelection } from '@/utils/faceted-filters';
import { collectionPath, type CollectionRoute } from '@/utils/collection-routes';
import { loadCollectionInfo } from '@/utils/collection-info';
import { rememberRecentlyOpened } from '@/utils/recently-opened';
import { albumFromUrl, urlWithAlbum } from '@/utils/album-url';
import { neighbourAlbum, swipeStep, type Point } from '@/utils/album-steps';

// Puts the open album into the address (Next keeps useSearchParams in step with pushState and replaceState)
const writeAlbumToUrl = (albumId: string | null, mode: 'push' | 'replace') => {
  const target = urlWithAlbum(window.location.href, albumId);
  if (mode === 'push') window.history.pushState(null, '', target);
  else window.history.replaceState(null, '', target);
};

interface CollectionBrowserProps {
  // Collection or series from the URL
  route: CollectionRoute;
  // Series collection this series was opened from (breadcrumb "Collections / collection / series")
  parentCollectionId?: string;
}

export default function CollectionBrowser({ route, parentCollectionId }: CollectionBrowserProps) {
  // The URL decides which collection is shown; preferences only remember the last one opened
  const { preferences: prefs, isInitialized } = usePreferences();
  const activeCollectionId = route.mbid;
  const activeEntityType = route.entityType;

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
    selectedAlbumDetailsError,
    retryAlbumDetails,
    handleSelectAlbum,
    refreshAlbum,
    chooseRelease,
    refreshAlbums,
    collectionName,
    collectionId,
    sortOption,
    setSortOption,
    useGenresOnly,
    spotifyUseDesktopApp,
    preferences
  } = useAlbums(activeCollectionId, activeEntityType);

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
  } = useFilters(rawAlbums, `${route.entityType}:${route.mbid}`);

  // The active filters; the date range counts only when it narrows the collection's own years
  const filterSelection = useMemo<FilterSelection>(() => ({
    genres: selectedGenres,
    labels: selectedLabels,
    tags: selectedTags,
    dateRange: releaseDateRange && availableYearRange &&
      (releaseDateRange.min !== availableYearRange.min || releaseDateRange.max !== availableYearRange.max)
      ? releaseDateRange
      : null,
    ratingRange,
  }), [selectedGenres, selectedLabels, selectedTags, releaseDateRange, availableYearRange, ratingRange]);

  // Apply filters to get final album list (genres, labels, tags: any of; kinds, dates, rating: all)
  const albums = useMemo(
    () => searchFilteredAlbums.filter(album => albumMatchesSelection(album, filterSelection)),
    [searchFilteredAlbums, filterSelection]
  );

  // Chip counts in the filter panel follow the search and the other filters (only while the panel is open)
  const chipStats = useMemo(
    () => (isFilterPanelOpen ? facetedStats(searchFilteredAlbums, filterSelection) : { genreStats, labelStats, tagStats }),
    [isFilterPanelOpen, searchFilteredAlbums, filterSelection, genreStats, labelStats, tagStats]
  );

  // A search that finds nothing only because the filters hide its matches says so (with a way out)
  const hiddenByFilters = albums.length === 0 && hasActiveFilters && searchQuery.trim() ? searchFilteredAlbums.length : 0;

  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const headerRef = useRef<HeaderRef>(null);

  // Height of the pinned top area (header, active filters, filter tray), so the docked details
  // panel starts right below it and fills the rest of the window
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--top-height', `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { isAuthenticated } = useAuth();
  const { updateApi, updateMetadata } = usePreferences();

  // Remember the collection from the URL as the last one opened, so / opens it next time.
  // Once per route: another tab on a different collection rewrites the stored one, and
  // syncing back on every change would make the two tabs overwrite each other forever.
  const syncedRouteRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isInitialized) return;
    const routeKey = collectionPath(route.entityType, route.mbid);
    if (syncedRouteRef.current === routeKey) return;
    syncedRouteRef.current = routeKey;
    if (prefs.api.collectionId === route.mbid && (prefs.metadata.entityType ?? 'collection') === route.entityType) return;
    updateApi({ collectionId: route.mbid });
    updateMetadata({ entityType: route.entityType });
  }, [route, isInitialized, prefs.api.collectionId, prefs.metadata.entityType, updateApi, updateMetadata]);

  // Name of the series collection this series was opened from (remembered by the Collections page or the collection page)
  const [parentName, setParentName] = useState<string | null>(null);
  useEffect(() => {
    if (!parentCollectionId) return;
    let cancelled = false;
    loadCollectionInfo(parentCollectionId).then(info => {
      if (!cancelled) setParentName(info?.name || 'Series collection');
    });
    return () => { cancelled = true; };
  }, [parentCollectionId]);
  const parentCrumb = parentCollectionId && parentName
    ? { href: collectionPath('collection', parentCollectionId), name: parentName }
    : undefined;

  // The stored name belongs to the stored collection; until it matches the URL, show no name
  const shownCollectionName = prefs.api.collectionId === collectionId ? collectionName : '';

  // Tab title: the open album (title – artist) and the collection
  const selectedAlbumLabel = selectedAlbum
    ? [selectedAlbum.title, selectedAlbum.artist_credit?.map(credit => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`).join('')]
        .filter(Boolean).join(' – ')
    : null;

  // A series' official homepage, linked by its domain in the footnote
  const seriesHomepage = useSeriesHomepage(route.entityType === 'series' ? route.mbid : null);

  // Recently opened list on the Collections page
  useEffect(() => {
    if (!shownCollectionName) return;
    rememberRecentlyOpened({
      entityType: route.entityType,
      mbid: route.mbid,
      name: shownCollectionName,
      kind: route.entityType === 'series' ? 'series' : 'release_group_collection',
      parentCollectionId: route.entityType === 'series' ? parentCollectionId : undefined,
    });
  }, [shownCollectionName, route.entityType, route.mbid, parentCollectionId]);

  // The open album is part of the address. Opening it adds a history entry, so Back (the phone's back
  // gesture too) closes the panel instead of leaving the collection; switching albums replaces the entry,
  // so Back never steps through every album looked at
  const albumEntryPushedRef = useRef(false);

  const openAlbum = (album: ReleaseGroup) => {
    const alreadyOpen = detailsPanelOpen && selectedAlbum !== null;
    writeAlbumToUrl(album.id, alreadyOpen ? 'replace' : 'push');
    if (!alreadyOpen) albumEntryPushedRef.current = true;
    handleSelectAlbum(album);
    setDetailsPanelOpen(true);
  };

  // Close button, Escape, clicking the open album again: goes back over the entry opening it added,
  // or (opened from a link or a reload) removes the album from the address
  const closeAlbum = useCallback(() => {
    setDetailsPanelOpen(false);
    handleSelectAlbum(null);
    if (albumFromUrl(window.location.href) === null) return;
    if (albumEntryPushedRef.current) {
      albumEntryPushedRef.current = false;
      window.history.back();
    } else {
      writeAlbumToUrl(null, 'replace');
    }
  }, [handleSelectAlbum]);

  // Back and Forward: show the album the address names now (or none)
  useEffect(() => {
    const handlePopState = () => {
      const albumId = albumFromUrl(window.location.href);
      albumEntryPushedRef.current = false;
      if (!albumId) {
        setDetailsPanelOpen(false);
        handleSelectAlbum(null);
        return;
      }
      const album = rawAlbums.find(a => a.id === albumId);
      if (album && album.id !== selectedAlbum?.id) {
        handleSelectAlbum(album);
        setDetailsPanelOpen(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [rawAlbums, selectedAlbum, handleSelectAlbum]);

  // Opened from a link or reloaded with an album in the address: open it once the collection is there.
  // An album that is not in this collection is dropped from the address
  const restoredAlbumRef = useRef(false);
  useEffect(() => {
    if (restoredAlbumRef.current || loading || rawAlbums.length === 0) return;
    restoredAlbumRef.current = true;
    const albumId = albumFromUrl(window.location.href);
    if (!albumId) return;
    const album = rawAlbums.find(a => a.id === albumId);
    if (!album) {
      writeAlbumToUrl(null, 'replace');
      return;
    }
    handleSelectAlbum(album);
    // Opening the panel once the collection has loaded (it cannot be known any earlier)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailsPanelOpen(true);
  }, [loading, rawAlbums, handleSelectAlbum]);

  // Selecting an album opens the details panel (the filter tray may stay open beside it); clicking the open album again closes the panel
  const handleAlbumClick = (album: ReleaseGroup) => {
    if (detailsPanelOpen && selectedAlbum?.id === album.id) {
      closeAlbum();
      return;
    }
    openAlbum(album);
  };

  // Handle close details panel
  const handleCloseDetailsPanel = closeAlbum;

  // Previous or next album in the grid as shown (sort, filters, search); nothing happens at either end.
  // The address is replaced, so one Back still closes the panel
  const stepAlbum = (step: 1 | -1) => {
    if (!detailsPanelOpen || !selectedAlbum) return;
    const next = neighbourAlbum(albums, selectedAlbum.id, step);
    if (!next) return;
    openAlbum(next);
    // Keyboard focus follows the album when it was on a card: the arrow keys make the browser show its focus
    // ring, which would otherwise stay on the card first clicked and highlight two albums. Focus inside the
    // panel or elsewhere is left where it is
    const focusWasOnCard = document.activeElement instanceof HTMLElement && document.activeElement.hasAttribute('data-album-id');
    // Keep the highlighted card in view (behind the panel on phones, so Back lands on it)
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-album-id="${next.id}"]`);
      if (!card) return;
      if (focusWasOnCard) card.focus({ preventScroll: true });
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  };

  // The key and swipe handlers always call the latest stepAlbum
  const stepAlbumRef = useRef(stepAlbum);
  useEffect(() => {
    stepAlbumRef.current = stepAlbum;
  });

  // Left and right arrow keys step through the albums while the panel is open; typing in a field and
  // key combinations (browser shortcuts) are left alone
  useEffect(() => {
    if (!detailsPanelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      event.preventDefault();
      stepAlbumRef.current(event.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [detailsPanelOpen]);

  // Swiping the panel sideways (touch) steps through the albums; swipes from the screen edge stay the
  // phone's back gesture, and mostly vertical ones keep scrolling the panel
  const swipeStartRef = useRef<Point | null>(null);
  const handlePanelTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    swipeStartRef.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const handlePanelTouchEnd = (event: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const step = swipeStep(start, { x: touch.clientX, y: touch.clientY }, window.innerWidth);
    if (step) stepAlbum(step);
  };

  // Escape closes the album details first, then the filter tray; typing in a field keeps them open
  const anyPanelOpen = detailsPanelOpen || isFilterPanelOpen;
  useEffect(() => {
    if (!anyPanelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if (detailsPanelOpen) {
        closeAlbum();
      } else {
        setFilterPanelOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [anyPanelOpen, detailsPanelOpen, isFilterPanelOpen, closeAlbum, setFilterPanelOpen]);

  // Handle manual refresh of current collection
  const handleRefreshCollection = async () => {
    if (!collectionId || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const { forceRefreshCollection } = await import('@/utils/progressive-loader');
      await forceRefreshCollection(collectionId, route.entityType === 'series' ? 'series' : 'collection');

      // Trigger UI refresh
      refreshAlbums();
    } catch (error) {
      console.error('Failed to refresh collection:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-set sort to 'series-order' when entity type changes to 'series'
  const prevEntityTypeRef = useRef<'collection' | 'series' | undefined>(undefined);
  useEffect(() => {
    if (activeEntityType === 'series' && prevEntityTypeRef.current !== 'series') {
      setSortOption('series-order');
    }
    prevEntityTypeRef.current = activeEntityType;
  }, [activeEntityType, setSortOption]);

  // Handle title click - close all panels and scroll to top
  const handleTitleClick = () => {
    // Close all panels
    if (detailsPanelOpen) closeAlbum();
    setFilterPanelOpen(false);

    // Close sort dropdown
    headerRef.current?.closeSortDropdown();

    // Clear search bar
    setSearchQuery('');

    // Scroll to top with smooth animation
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // "1,226 release groups", or "10 of 1,226" while a search or filter narrows the grid
  const albumCountLabel = !loading && totalAlbums > 0
    ? albums.length < totalAlbums
      ? `${albums.length.toLocaleString()} of ${totalAlbums.toLocaleString()}`
      : `${totalAlbums.toLocaleString()} ${totalAlbums === 1 ? 'release group' : 'release groups'}`
    : null;

  return (
    <main className="flex min-h-screen flex-col">
      <PageTitle parts={[selectedAlbumLabel, shownCollectionName]} />
      {/* Header, active filters and the filter tray stay pinned together at the top */}
      <div ref={topRef} className="sticky top-0 z-30 bg-background">
      <Suspense fallback={
        <div className="h-16 bg-background-secondary border-b border-background-tertiary" />
      }>
        <Header
          ref={headerRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          collectionName={shownCollectionName}
          parentCrumb={parentCrumb}
          onTitleClick={handleTitleClick}
          sortOption={sortOption}
          setSortOption={setSortOption}
          entityType={activeEntityType}
          isFilterPanelOpen={isFilterPanelOpen}
          toggleFilterPanel={toggleFilterPanel}
          activeFilterCount={activeFilterCount}
          hasActiveFilters={hasActiveFilters}
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
        genreStats={chipStats.genreStats}
        labelStats={chipStats.labelStats}
        tagStats={chipStats.tagStats}
        collectionHasLabels={labelStats.length > 0}
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
      </div>

      {error && (
        <div className="p-6">
          <div role="alert" className="p-4 bg-background-tertiary border border-background-secondary rounded-md">
            <h2 className="text-lg font-medium mb-2 text-red-500">Couldn&apos;t load this {activeEntityType === 'series' ? 'series' : 'collection'}</h2>
            <p className="text-text-secondary">{error}</p>
            {collectionId && (
              <button
                type="button"
                onClick={refreshAlbums}
                className="mt-4 px-4 py-1.5 rounded-full bg-primary text-white text-sm hover:bg-primary-light transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid and the docked album details side by side: the panel narrows the grid instead of covering it */}
      <div className="flex-1 flex items-start">
      <div className="flex-1 min-w-0 self-stretch flex flex-col pt-3 md:pt-6">
        <LazyAlbumGrid
          albums={albums}
          selectedAlbum={selectedAlbum}
          onSelectAlbum={handleAlbumClick}
          loading={loading}
          // After a failed load the error box above explains the empty grid
          emptyState={error ? false : hiddenByFilters > 0 ? (
            <>
              <p>
                {hiddenByFilters} {hiddenByFilters === 1 ? 'release group matches' : 'release groups match'} your search but {hiddenByFilters === 1 ? 'is' : 'are'} hidden by your filters.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-4 py-1.5 rounded-full bg-primary text-white text-sm hover:bg-primary-light transition-colors"
              >
                Clear filters
              </button>
            </>
          ) : searchQuery.trim() ? (
            <p>No release groups match &ldquo;{searchQuery.trim()}&rdquo;.</p>
          ) : hasActiveFilters ? (
            <>
              <p>No release groups match your filters.</p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-4 py-1.5 rounded-full bg-primary text-white text-sm hover:bg-primary-light transition-colors"
              >
                Clear filters
              </button>
            </>
          ) : undefined}
        />
        {shownCollectionName && (
          <CollectionFootnote
            name={shownCollectionName}
            count={albumCountLabel}
            musicBrainzUrl={collectionId ? `https://musicbrainz.org/${activeEntityType ?? 'collection'}/${collectionId}` : undefined}
            musicBrainzLabel={`this ${activeEntityType ?? 'collection'}`}
            homepageUrl={seriesHomepage}
            onReload={collectionId ? handleRefreshCollection : undefined}
            isReloading={isRefreshing}
          />
        )}
    </div>
        <aside
          aria-label="Album details"
          className={`details-dock ${detailsPanelOpen ? 'open' : ''}`}
          onTouchStart={handlePanelTouchStart}
          onTouchEnd={handlePanelTouchEnd}
          onTouchCancel={() => { swipeStartRef.current = null; }}
        >
          <AlbumDetailsPanel
            album={selectedAlbum}
            albumDetails={selectedAlbumDetails}
            loading={selectedAlbumLoading}
            detailsError={selectedAlbumDetailsError}
            onRetryDetails={retryAlbumDetails}
            isOpen={detailsPanelOpen}
            onClose={handleCloseDetailsPanel}
            useGenresOnly={useGenresOnly}
            onToggleGenre={toggleGenre}
            onToggleLabel={prefs.display.enableLabelFilter ? toggleLabel : undefined}
            selectedGenres={selectedGenres}
            selectedLabels={prefs.display.enableLabelFilter ? selectedLabels : []}
            spotifyUseDesktopApp={spotifyUseDesktopApp}
            tidalUseDesktopApp={preferences.streaming.tidalUseDesktopApp}
            appleMusicUseDesktopApp={preferences.streaming.appleMusicUseDesktopApp}
            enabledStreamingServices={preferences.streaming.enabledServices}
            showRatings={preferences.display.showRatings}
            ratingDisplayMode={preferences.display.ratingDisplayMode}
            isAuthenticated={isAuthenticated}
            onRefreshAlbum={refreshAlbum}
            onChooseRelease={chooseRelease}
          />

        </aside>
      </div>
    </main>
  );
}
