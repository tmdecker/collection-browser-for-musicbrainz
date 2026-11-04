/**
 * @ai-file component
 * @ai-description Collection header with breadcrumb (back arrow on phones), search, sort, filter and account button
 * @ai-dependencies React, SearchBar, SortDropdown, FilterButton, UserAvatarButton, AuthResultToast
 * @ai-features
 * - Responsive single row: breadcrumb (from md) or a back arrow (phones) left; search, sort, filter and account button (from md) right
 * - Breadcrumb "Collections / name"; a floating footnote (CollectionFootnote) carries the name, count, MusicBrainz link and reload
 * - Phones: back arrow to the series collection a series was opened from, else to Collections (no breadcrumb there)
 * - Settings, login and logout live in the account button's menu
 * - Glass morphism styling with sticky positioning
 * - Dynamic header heights via CSS variables (64px desktop, 56px mobile)
 */

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import Link from 'next/link';
import { BiArrowBack } from 'react-icons/bi';
import AuthResultToast from './AuthResultToast';
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

  // Click on the current name in the breadcrumb: back to the top, panels closed (like the footnote name)
  onTitleClick?: () => void;

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
      <AuthResultToast />
      <header
        className="relative z-30 p-3 md:px-8 md:pt-4 md:pb-4 header-surface"
      >
      {/* One row: breadcrumb (back arrow on phones) on the left; search, sort, filter and the account button on the right.
          The breadcrumb only shows from md; on phones the search fills the row. */}
      <div className="flex items-center gap-2 md:gap-3 w-full">
        <div className="flex items-center min-w-0 flex-shrink-0 md:flex-1">
          {/* Phones have no breadcrumb: a back arrow to the series collection or to Collections */}
          <Link
            href={parentCrumb?.href ?? '/collections'}
            className="md:hidden p-2 rounded-full bg-background-control hover:bg-white/20 text-white/75 hover:text-white transition-colors border border-white/15 hover:border-white/35 flex-shrink-0"
            title={`Back to ${parentCrumb?.name ?? 'Collections'}`}
            aria-label={`Back to ${parentCrumb?.name ?? 'Collections'}`}
          >
            <BiArrowBack className="w-5 h-5" />
          </Link>

          {/* Breadcrumb from md: Collections / name, or "Collections / collection / series" for a series
              opened from a series collection ("Collections /" from lg there).
              The name, count and MusicBrainz link also float in the grid's bottom-left corner. */}
          <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 min-w-0 text-[15px]">
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
            <button
              type="button"
              onClick={onTitleClick}
              className="min-w-0 truncate font-semibold text-white hover:text-white/80 transition-colors"
              aria-current="page"
              title="Return to top and close panels"
            >
              {displayName}
            </button>
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
