/**
 * @ai-file component
 * @ai-description Application header with menu, collection name, search, sort, and filter
 * @ai-dependencies React, SearchBar, SortDropdown, FilterButton, useAuth
 * @ai-features
 * - Responsive layout: desktop single-row, mobile two-row stacked
 * - Hamburger menu with auth status, settings, and navigation
 * - Auto-fetched collection name display with truncation
 * - Glass morphism styling with sticky positioning
 * - Dynamic header heights via CSS variables (64px desktop, 96px mobile)
 */

import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import SearchBar from './SearchBar';
import SortDropdown, { SortDropdownRef } from './SortDropdown';
import FilterButton from './FilterButton';
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
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`px-4 py-3 rounded-lg shadow-lg backdrop-blur-md border ${
            authMessage.type === 'success'
              ? 'bg-green-900/90 text-green-100 border-green-500/30'
              : 'bg-red-900/90 text-red-100 border-red-500/30'
          }`}>
            <div className="flex items-center space-x-2">
              {authMessage.type === 'success' ? (
                <BiUserCheck className="flex-shrink-0" size={20} />
              ) : (
                <BiUserX className="flex-shrink-0" size={20} />
              )}
              <span className="text-sm font-medium">{authMessage.text}</span>
            </div>
          </div>
        </div>
      )}

      <header
        className="sticky top-0 z-30 p-3 md:px-6 md:pt-4 md:pb-4 relative"
        style={{
          boxSizing: 'border-box',
          margin: '0',
          background: 'rgba(18,18,18,0.85)',
          backdropFilter: 'blur(8px) saturate(1.2)'
        }}
      >
      {/* Desktop Layout: Compact with Hover Details */}
      <div className="hidden md:flex items-center justify-between h-8">
        {/* Left: Menu Button + Collection Name + Switcher + Auth Status */}
        <div className="flex items-center space-x-2 min-w-0 flex-shrink">
          {/* Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-full backdrop-blur-md bg-[#1E1E1E]/75 hover:bg-white/20 text-white/75 hover:text-white transition-colors border border-white/15 hover:border-white/35 flex-shrink-0"
            title="Menu"
          >
            {mobileMenuOpen ? <BiX size={24} /> : <BiMenu size={24} />}
          </button>

          {/* Collection Name */}
          <h1
            className="text-sm font-bold text-white/70 truncate cursor-pointer hover:text-white transition-colors"
            onClick={onTitleClick}
            title="Return to top and close panels"
          >
            {displayName}
          </h1>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md mx-4">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        {/* Right: Sort + Filter */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          {/* Sort Dropdown */}
          <SortDropdown
            ref={sortDropdownRef}
            value={sortOption}
            onChange={setSortOption}
            entityType={entityType}
          />
          {/* Filter Button */}
          <FilterButton
            isFilterPanelOpen={isFilterPanelOpen}
            toggleFilterPanel={toggleFilterPanel}
            activeFilterCount={activeFilterCount}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </div>

      {/* Mobile Layout: Single Row */}
      <div className="flex md:hidden items-center space-x-2 w-full">
        {/* Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-full backdrop-blur-md bg-[#1E1E1E]/75 hover:bg-white/20 text-white/75 hover:text-white transition-colors border border-white/15 hover:border-white/35 flex-shrink-0"
          title="Menu"
        >
          {mobileMenuOpen ? <BiX size={20} /> : <BiMenu size={20} />}
        </button>

        {/* Search Bar */}
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        {/* Sort Dropdown */}
        <SortDropdown
          ref={sortDropdownRef}
          value={sortOption}
          onChange={setSortOption}
          entityType={entityType}
        />

        {/* Filter Button */}
        <FilterButton
          isFilterPanelOpen={isFilterPanelOpen}
          toggleFilterPanel={toggleFilterPanel}
          activeFilterCount={activeFilterCount}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Menu Dropdown - Absolute positioned overlay */}
      {mobileMenuOpen && (
        <div ref={menuRef} className="absolute left-3 md:left-6 top-full mt-2 w-[calc(100%-1.5rem)] md:w-80 rounded-3xl backdrop-blur-md bg-[#1A1A1A]/95 border border-white/10 overflow-hidden shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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

          {/* Browse Collections (accessible to all users) */}
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
            <span className="text-white font-medium">Browse Collections</span>
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
