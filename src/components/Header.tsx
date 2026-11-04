/**
 * @ai-file component
 * @ai-description Collection header with menu, breadcrumb, search, sort, and filter
 * @ai-dependencies React, AppMenu, SearchBar, SortDropdown, FilterButton
 * @ai-features
 * - Responsive single row: menu, search, sort, filter; breadcrumb from md up
 * - Breadcrumb "Collections / name"; a floating footnote (CollectionFootnote) carries the name, count and MusicBrainz link
 * - App menu with auth status, Collections, reload, settings
 * - Glass morphism styling with sticky positioning
 * - Dynamic header heights via CSS variables (64px desktop, 56px mobile)
 */

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import Link from 'next/link';
import AppMenu from './AppMenu';
import SearchBar from './SearchBar';
import SortDropdown, { SortDropdownRef } from './SortDropdown';
import FilterButton from './FilterButton';
import { SortOption } from '@/types/music';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  collectionName: string;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  entityType?: 'collection' | 'series';

  // Filter-related props
  isFilterPanelOpen: boolean;
  toggleFilterPanel: () => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;

  // Series collection a series was opened from, shown between "Collections" and the name
  parentCrumb?: { href: string; name: string };

  // Reload the collection from MusicBrainz (menu item)
  onReloadCollection?: () => void;
  isReloadingCollection?: boolean;

  // Title click handler (phone menu item with the current name)
  onTitleClick: () => void;

}

export interface HeaderRef {
  closeSortDropdown: () => void;
}

const Header = forwardRef<HeaderRef, HeaderProps>(({
  searchQuery,
  setSearchQuery,
  collectionName,
  sortOption,
  setSortOption,
  entityType,
  isFilterPanelOpen,
  toggleFilterPanel,
  activeFilterCount,
  hasActiveFilters,
  onReloadCollection,
  isReloadingCollection,
  parentCrumb,
  onTitleClick,
}, ref) => {
  const sortDropdownRef = useRef<SortDropdownRef>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    closeSortDropdown: () => sortDropdownRef.current?.closeDropdown()
  }));

  // Calculate the display name
  const displayName = collectionName || 'Music Collection';

  return (
    <>
      <header
        className="relative z-30 p-3 md:px-8 md:pt-4 md:pb-4 header-surface"
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
            parentLink={parentCrumb}
          />

          {/* Breadcrumb from md: Collections / name; for a series opened from a series collection
              "collection / series", with "Collections /" in front only on very wide screens.
              The name, count and MusicBrainz link also float in the grid's bottom-left corner. */}
          <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 min-w-0 !ml-3 text-[15px]">
            <Link
              href="/collections"
              className={`${parentCrumb ? 'hidden 2xl:inline' : 'inline'} text-text-secondary hover:text-white transition-colors flex-shrink-0`}
            >
              Collections
            </Link>
            <span className={`${parentCrumb ? 'hidden 2xl:inline' : 'inline'} text-white/30 flex-shrink-0`} aria-hidden="true">/</span>
            {parentCrumb && (
              <>
                <Link
                  href={parentCrumb.href}
                  className="text-text-secondary hover:text-white transition-colors min-w-[2.5rem] truncate shrink-[4]"
                >
                  {parentCrumb.name}
                </Link>
                <span className="text-white/30 flex-shrink-0" aria-hidden="true">/</span>
              </>
            )}
            <span className="min-w-0 truncate font-semibold text-white" aria-current="page">{displayName}</span>
          </nav>
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
