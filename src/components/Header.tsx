/**
 * @ai-file component
 * @ai-description Collection header with menu, breadcrumb, search, sort, and filter
 * @ai-dependencies React, AppMenu, SearchBar, SortDropdown, FilterButton
 * @ai-features
 * - Responsive single row: menu and breadcrumb (from md) left; search, sort, filter and account button (from md) right
 * - Breadcrumb "Collections / name"; a floating footnote (CollectionFootnote) carries the name, count and MusicBrainz link
 * - App menu with auth status, Collections, reload, settings
 * - Glass morphism styling with sticky positioning
 * - Dynamic header heights via CSS variables (64px desktop, 56px mobile)
 */

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import Link from 'next/link';
import AppMenu from './AppMenu';
import SearchBar from './SearchBar';
import UserAvatarButton from './UserAvatarButton';
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
      {/* One row: menu and breadcrumb on the left; search, sort, filter and the account button on the right.
          The breadcrumb only shows from md; on phones the search fills the row. */}
      <div className="flex items-center gap-2 md:gap-3 w-full">
        <div className="flex items-center min-w-0 flex-shrink-0 md:flex-1">
          <AppMenu
            currentName={displayName}
            onCurrentNameClick={onTitleClick}
            onReloadCollection={onReloadCollection}
            isReloadingCollection={isReloadingCollection}
            parentLink={parentCrumb}
            showAccountOnPhones
          />

          {/* Breadcrumb from md: Collections / name, or "Collections / collection / series" for a series
              opened from a series collection ("Collections /" from lg there).
              The name, count and MusicBrainz link also float in the grid's bottom-left corner. */}
          <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 min-w-0 ml-3 text-[15px]">
            <Link
              href="/collections"
              className={`${parentCrumb ? 'hidden lg:inline' : 'inline'} text-text-secondary hover:text-white transition-colors flex-shrink-0`}
            >
              Collections
            </Link>
            <span className={`${parentCrumb ? 'hidden lg:inline' : 'inline'} text-white/30 flex-shrink-0`} aria-hidden="true">/</span>
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

        <div className="flex-1 min-w-0 md:flex-none md:w-[260px] lg:w-[340px]">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
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
          <UserAvatarButton className="hidden md:block" />
        </div>
      </div>

      </header>
    </>
  );
});

Header.displayName = 'Header';

export default Header;
