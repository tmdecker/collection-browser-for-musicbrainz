/**
 * @ai-file component
 * @ai-description Collection header with menu, breadcrumb, search, sort, and filter
 * @ai-dependencies React, AppMenu, SearchBar, SortDropdown, FilterButton
 * @ai-features
 * - Responsive single row: menu, search, sort, filter; breadcrumb from md up
 * - Breadcrumb "Collections / name" with release group count and a MusicBrainz link
 * - App menu with auth status, Collections, reload, settings
 * - Glass morphism styling with sticky positioning
 * - Dynamic header heights via CSS variables (64px desktop, 56px mobile)
 */

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import Link from 'next/link';
import { SiMusicbrainz } from 'react-icons/si';
import AppMenu from './AppMenu';
import SearchBar from './SearchBar';
import SortDropdown, { SortDropdownRef } from './SortDropdown';
import FilterButton from './FilterButton';
import { SortOption } from '@/types/music';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  totalAlbums: number | string;
  filteredAlbums: number;
  collectionName: string;
  collectionId: string;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  entityType?: 'collection' | 'series';

  // Filter-related props
  isFilterPanelOpen: boolean;
  toggleFilterPanel: () => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;

  // Reload the collection from MusicBrainz (menu item)
  onReloadCollection?: () => void;
  isReloadingCollection?: boolean;

  // Title click handler
  onTitleClick: () => void;

}

export interface HeaderRef {
  closeSortDropdown: () => void;
}

const Header = forwardRef<HeaderRef, HeaderProps>(({
  searchQuery,
  setSearchQuery,
  totalAlbums,
  filteredAlbums,
  collectionName,
  collectionId,
  sortOption,
  setSortOption,
  entityType,
  isFilterPanelOpen,
  toggleFilterPanel,
  activeFilterCount,
  hasActiveFilters,
  onReloadCollection,
  isReloadingCollection,
  onTitleClick,
}, ref) => {
  const sortDropdownRef = useRef<SortDropdownRef>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    closeSortDropdown: () => sortDropdownRef.current?.closeDropdown()
  }));

  // Calculate the display name
  const displayName = collectionName || 'Music Collection';

  // "1,226 release groups", or "10 of 1,226" while a search or filter narrows the grid
  const albumCountLabel = typeof totalAlbums === 'number' && totalAlbums > 0
    ? filteredAlbums < totalAlbums
      ? `${filteredAlbums.toLocaleString()} of ${totalAlbums.toLocaleString()}`
      : `${totalAlbums.toLocaleString()} ${totalAlbums === 1 ? 'release group' : 'release groups'}`
    : null;

  return (
    <>
      <header
        className="relative z-30 p-3 md:px-6 md:pt-4 md:pb-4 header-surface"
      >
      {/* One row at every width: the collection name only shows from md, where the row becomes a three-column grid */}
      <div className="flex items-center gap-2 w-full md:grid md:grid-cols-[1fr_minmax(auto,28rem)_1fr] md:gap-4">
        {/* Left: Menu Button + Collection Name */}
        <div className="flex items-center space-x-2 min-w-0 flex-shrink-0 md:flex-shrink">
          <AppMenu
            currentName={displayName}
            onCurrentNameClick={onTitleClick}
            onReloadCollection={onReloadCollection}
            isReloadingCollection={isReloadingCollection}
          />

          {/* Breadcrumb: Collections / name */}
          <Link
            href="/collections"
            className="hidden md:inline text-sm text-white/50 hover:text-white transition-colors flex-shrink-0 !ml-3"
          >
            Collections
          </Link>
          <span className="hidden md:inline text-sm text-white/30 flex-shrink-0" aria-hidden="true">/</span>
          <h1 className="hidden md:flex min-w-0">
            <button
              type="button"
              className="min-w-0 max-w-full text-sm font-bold text-white/70 hover:text-white transition-colors"
              onClick={onTitleClick}
              title="Return to top and close panels"
            >
              <span className="block truncate">{displayName}</span>
            </button>
          </h1>
          {albumCountLabel && (
            <span className="hidden md:inline ml-2 text-xs text-text-tertiary tabular-nums whitespace-nowrap flex-shrink-0" aria-live="polite">
              {albumCountLabel}
            </span>
          )}
          {collectionId && (
            <a
              href={`https://musicbrainz.org/${entityType ?? 'collection'}/${collectionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex ml-2 text-text-secondary hover:text-white transition-colors duration-200 flex-shrink-0"
              title={`Open this ${entityType ?? 'collection'} on MusicBrainz`}
              aria-label={`Open this ${entityType ?? 'collection'} on MusicBrainz`}
            >
              <SiMusicbrainz size={16} />
            </a>
          )}
        </div>

        {/* Center: Search Bar (the md grid centers this column) */}
        <div className="flex-1 min-w-0 md:w-full md:justify-self-center">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        {/* Right: Sort + Filter */}
        <div className="flex items-center gap-2 md:gap-3 md:justify-self-end">
          <SortDropdown
            ref={sortDropdownRef}
            value={sortOption}
            onChange={setSortOption}
            entityType={entityType}
          />
          <FilterButton
            isFilterPanelOpen={isFilterPanelOpen}
            toggleFilterPanel={toggleFilterPanel}
            activeFilterCount={activeFilterCount}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </div>

      </header>
    </>
  );
});

Header.displayName = 'Header';

export default Header;
