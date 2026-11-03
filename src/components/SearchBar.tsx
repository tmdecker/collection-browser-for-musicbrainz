/**
 * @ai-file component
 * @ai-description Search input with custom styling and responsive placeholder text
 * @ai-dependencies React
 * @ai-features
 * - Rounded search input with custom clear button styling
 * - Hover and focus states with visual feedback
 * - Multi-level responsive placeholder text (3 breakpoints)
 * - Responsive padding and icon sizing for optimal mobile layout
 */

import React, { useRef, useEffect, useState } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search albums, artists...'
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dynamicPlaceholder, setDynamicPlaceholder] = useState(placeholder);

  // Detect screen size and set appropriate placeholder text with 3-tier system:
  // < 400px: "Search..." (ultra-compact)
  // 400-640px: "Search albums..." (compact)
  // > 640px: "Search albums, artists..." (full)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 400) { // Very small screens
        setDynamicPlaceholder('Search...');
      } else if (window.innerWidth < 640) { // Small screens (sm breakpoint)
        setDynamicPlaceholder('Search albums...');
      } else {
        setDynamicPlaceholder(placeholder);
      }
    };

    // Set initial placeholder
    handleResize();

    // Add event listener for window resize
    window.addEventListener('resize', handleResize);

    // Cleanup event listener
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [placeholder]);

  // The clear (x) button is styled in globals.css
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3 pointer-events-none z-10">
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6 text-white/70"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="search"
        id="music-search"
        name="music-search"
        className="block w-full pl-10 sm:pl-12 pr-2 sm:pr-3 py-2.5 text-sm text-white placeholder:text-white/55 bg-background-control rounded-full transition-all duration-200 ease-in-out border border-white/15 hover:bg-white/20 hover:border-white/35 focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white/20 focus:outline-none"
        placeholder={dynamicPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search for albums and artists"
        autoComplete="off"
      />
    </div>
  );
};

export default SearchBar;
