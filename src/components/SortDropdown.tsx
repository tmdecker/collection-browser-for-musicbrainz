/**
 * @ai-file component
 * @ai-description Sort dropdown with 6 sorting options for album collections
 * @ai-dependencies React, SortOption type, react-icons/bi
 * @ai-features
 * - Glass morphism dropdown with 6 sort options (artist A-Z/Z-A, title A-Z/Z-A, date oldest/newest)
 * - Click-outside handling
 * - Exposes closeDropdown method via forwardRef
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { SortOption } from '@/types/music';
import { BiSort } from 'react-icons/bi';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export interface SortDropdownRef {
  closeDropdown: () => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'artist-asc', label: 'Artist A-Z' },
  { value: 'artist-desc', label: 'Artist Z-A' },
  { value: 'title-asc', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' },
  { value: 'date-old-new', label: 'Release: Oldest' },
  { value: 'date-new-old', label: 'Release: Newest' },
];

const SortDropdown = forwardRef<SortDropdownRef, SortDropdownProps>(({ value, onChange }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Expose the closeDropdown method via ref
  useImperativeHandle(ref, () => ({
    closeDropdown: () => setIsOpen(false)
  }));

  // Close dropdown when clicking outside
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleOptionClick = (option: SortOption) => {
    onChange(option);
    setIsOpen(false);
  };

  const getCurrentLabel = () => {
    const option = sortOptions.find(opt => opt.value === value);
    return option?.label || 'Sort';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Sort Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-full backdrop-blur-md transition-colors flex items-center space-x-1 border ${
          isOpen
            ? 'bg-white/20 text-white border-white/35'
            : 'bg-[#1E1E1E]/75 hover:bg-white/20 text-white/75 hover:text-white border-white/15 hover:border-white/35'
        }`}
        title={`Sort by: ${getCurrentLabel()}`}
        aria-label="Sort options"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Sort Icon */}
        <BiSort size={24} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[#1A1A1A]/95 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleOptionClick(option.value)}
              className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                value === option.value
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.07]'
              }`}
              role="menuitem"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

SortDropdown.displayName = 'SortDropdown';

export default SortDropdown;