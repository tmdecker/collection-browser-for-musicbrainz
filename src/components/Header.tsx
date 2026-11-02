/**
 * @ai-file component
 * @ai-description Application header with menu, collection name, search, sort, and filter
 * @ai-dependencies React, SearchBar, SortDropdown, FilterButton, useAuth
 * @ai-features
 * - Responsive single row: menu, search, sort, filter; collection name from md up
 * - Hamburger menu with auth status, settings, and navigation
 * - Auto-fetched collection name display with truncation
 * - Glass morphism styling with sticky positioning
 * - Dynamic header heights via CSS variables (64px desktop, 56px mobile)
 */

import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import SearchBar from './SearchBar';
import SortDropdown, { SortDropdownRef } from './SortDropdown';
import FilterButton from './FilterButton';
import Toast from './Toast';
import { SortOption } from '@/types/music';
import { BiCollection, BiCog, BiMenu, BiX, BiUserX, BiUserCheck, BiLogOut, BiLinkExternal } from 'react-icons/bi';
import { useAuth } from '@/hooks/useAuth';

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

  // Collections panel props
  isCollectionsPanelOpen?: boolean;
  toggleCollectionsPanel?: () => void;

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
  isCollectionsPanelOpen = false,
  toggleCollectionsPanel,
  onTitleClick,
}, ref) => {
  const sortDropdownRef = useRef<SortDropdownRef>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get auth state
  const { isAuthenticated, user, login, logout: authLogout } = useAuth();

  // Wrap logout to show success message
  const logout = async () => {
    await authLogout();
    setAuthMessage({ type: 'success', text: 'Successfully logged out!' });
    setTimeout(() => setAuthMessage(null), 3000);
  };

  // Check for auth success/error from OAuth callback
  useEffect(() => {
    const authSuccess = searchParams.get('auth_success');
    const authError = searchParams.get('auth_error');

    // Only process if we have query params (prevents running after router.replace clears them)
    if (!authSuccess && !authError) return;

    if (authSuccess === 'true' && user) {
      // Only show message once user info is available
      setAuthMessage({ type: 'success', text: `Successfully logged in as ${user.name}!` });
      // Clear the URL parameter
      router.replace('/');
      // Auto-clear message after 3 seconds
      setTimeout(() => setAuthMessage(null), 3000);
    } else if (authError) {
      setAuthMessage({ type: 'error', text: `Login failed: ${authError}` });
      // Clear the URL parameter
      router.replace('/');
      // Auto-clear message after 5 seconds
      setTimeout(() => setAuthMessage(null), 5000);
    }
  }, [searchParams, router, user]);

  // Close menu when clicking outside
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Close menu on Escape key
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    closeSortDropdown: () => sortDropdownRef.current?.closeDropdown()
  }));

  // Calculate the display name
  const displayName = collectionName || 'Music Collection';

  return (
    <>
      {/* Auth Toast Notification */}
      {authMessage && (
        <Toast
          type={authMessage.type}
          message={authMessage.text}
          icon={authMessage.type === 'success'
            ? <BiUserCheck className="flex-shrink-0" size={20} />
            : <BiUserX className="flex-shrink-0" size={20} />}
        />
      )}

      <header
        className="sticky top-0 z-30 p-3 md:px-6 md:pt-4 md:pb-4 header-surface"
      >
      {/* One row at every width: the collection name only shows from md, where the row becomes a three-column grid */}
      <div className="flex items-center gap-2 w-full md:grid md:grid-cols-[1fr_minmax(auto,28rem)_1fr] md:gap-4 md:h-8">
        {/* Left: Menu Button + Collection Name */}
        <div className="flex items-center space-x-2 min-w-0 flex-shrink-0 md:flex-shrink">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-full backdrop-blur-md bg-background-control/75 hover:bg-white/20 text-white/75 hover:text-white transition-colors border border-white/15 hover:border-white/35 flex-shrink-0"
            title="Menu"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="true"
          >
            {mobileMenuOpen ? <BiX className="w-5 h-5 md:w-6 md:h-6" /> : <BiMenu className="w-5 h-5 md:w-6 md:h-6" />}
          </button>

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
          {entityType && (
            <span className="hidden md:inline ml-2 bg-gray-700/50 text-gray-300 text-xs px-2 py-0.5 rounded capitalize flex-shrink-0">
              {entityType}
            </span>
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

      {/* Menu Dropdown - Absolute positioned overlay */}
      {mobileMenuOpen && (
        <div ref={menuRef} className="absolute left-3 md:left-6 top-full mt-2 w-[calc(100%-1.5rem)] md:w-80 rounded-3xl backdrop-blur-md bg-background-secondary/95 border border-white/10 overflow-hidden shadow-lg z-50 animate-fade-in">
          {/* Collection Name - Only show on mobile since desktop already shows it */}
          <button
            onClick={() => {
              onTitleClick();
              setMobileMenuOpen(false);
            }}
            className="md:hidden w-full flex items-center space-x-3 px-4 py-3 hover:bg-white/10 transition-colors text-left border-b border-white/10"
          >
            <BiCollection className="text-white/70 flex-shrink-0" size={20} />
            <span className="text-white font-medium truncate">{displayName}</span>
            {entityType && (
              <span className="bg-gray-700/50 text-gray-300 text-xs px-2 py-0.5 rounded capitalize flex-shrink-0">
                {entityType}
              </span>
            )}
          </button>

          {/* Authentication Section */}
          {isAuthenticated && user ? (
            <div className="w-full flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center space-x-3 min-w-0">
                <BiUserCheck className="text-primary flex-shrink-0" size={20} />
                <a
                  href={`https://musicbrainz.org/user/${user.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-white font-medium hover:text-primary transition-colors inline-flex items-center gap-1 truncate"
                >
                  <span className="truncate">{user.name}</span>
                  <BiLinkExternal className="flex-shrink-0" size={12} />
                </a>
              </div>
              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-1 text-white/70 hover:text-white transition-colors flex-shrink-0 ml-2"
              >
                <BiLogOut className="flex-shrink-0" size={16} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            /* Login Button */
            <button
              onClick={() => {
                login();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-white/10 transition-colors text-left border-b border-white/10"
            >
              <BiUserX className="text-white/70 flex-shrink-0" size={20} />
              <span className="text-white font-medium inline-flex items-center gap-1">
                Login with MusicBrainz.org
                <BiLinkExternal className="flex-shrink-0" size={12} />
              </span>
            </button>
          )}

          {/* Browse Collections/Series (accessible to all users) */}
          <button
            onClick={() => {
              if (toggleCollectionsPanel) {
                toggleCollectionsPanel();
              }
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/10 text-left"
          >
            <BiCollection className="text-white/70 flex-shrink-0" size={20} />
            <span className="text-white font-medium">Browse</span>
          </button>

          {/* Settings */}
          <Link
            href="/config"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-white/10 transition-colors"
          >
            <BiCog className="text-white/70 flex-shrink-0" size={20} />
            <span className="text-white font-medium">Settings</span>
          </Link>
        </div>
      )}
      </header>
    </>
  );
});

Header.displayName = 'Header';

export default Header;
