/**
 * @ai-file component
 * @ai-description Persistent active filters bar that floats below the header
 * @ai-dependencies React, react-icons/bi
 * @ai-features
 * - Always visible when filters are active (regardless of filter panel state)
 * - Displays active filters from genres, labels, tags, dates, and ratings categories
 * - Sticky positioning below header with backdrop blur effect
 * - Individual filter removal with close buttons and clear all functionality
 * - Color-coded by category (purple/rose/orange/fuchsia/emerald)
 * - Smooth animations and responsive layout
 */

import React, { useRef, useEffect } from 'react';
import { BiX, BiStar } from 'react-icons/bi';
import { YearRange } from '@/utils/date-processor';

interface ActiveFiltersBarProps {
  selectedGenres: string[];
  selectedLabels: string[];
  selectedTags: string[];
  releaseDateRange: YearRange | null;
  availableYearRange: YearRange | null;
  ratingRange: { min: number; max: number } | null;
  onToggleGenre: (genreName: string) => void;
  onToggleLabel: (labelName: string) => void;
  onToggleTag: (tagName: string) => void;
  onClearDateFilter: () => void;
  onClearRatingFilter: () => void;
  onClearAll: () => void;
  isFilterPanelOpen: boolean;
}

const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = ({
  selectedGenres,
  selectedLabels,
  selectedTags,
  releaseDateRange,
  availableYearRange,
  ratingRange,
  onToggleGenre,
  onToggleLabel,
  onToggleTag,
  onClearDateFilter,
  onClearRatingFilter,
  onClearAll,
  isFilterPanelOpen
}) => {
  const barRef = useRef<HTMLDivElement>(null);

  // Check if date filter is active (not at full range)
  const hasDateFilter = releaseDateRange !== null &&
                        availableYearRange !== null &&
                        (releaseDateRange.min !== availableYearRange.min ||
                         releaseDateRange.max !== availableYearRange.max);

  // Check if rating filter is active
  const hasRatingFilter = ratingRange !== null;

  // Total active filters count
  const totalActiveFilters = selectedGenres.length + selectedLabels.length + selectedTags.length + (hasDateFilter ? 1 : 0) + (hasRatingFilter ? 1 : 0);

  // Update CSS variable with actual bar height using ResizeObserver
  useEffect(() => {
    if (barRef.current) {
      const updateHeight = () => {
        if (barRef.current) {
          const height = barRef.current.offsetHeight;
          document.documentElement.style.setProperty('--active-filters-height', `${height}px`);
        }
      };

      // Initial height update
      updateHeight();

      // Use ResizeObserver to track height changes (e.g., when filters wrap)
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(barRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    } else {
      document.documentElement.style.setProperty('--active-filters-height', '0px');
    }
  }, [selectedGenres, selectedLabels, selectedTags, releaseDateRange, ratingRange, isFilterPanelOpen]);

  // Show empty bar when filter panel is open but no filters selected
  if (totalActiveFilters === 0) {
    if (!isFilterPanelOpen) {
      return null; // Hide completely
    }
    // Show empty spacer bar with "No Active Filters" text
    return (
      <div
        ref={barRef}
        className="fixed z-25 left-0 right-0"
        style={{
          top: 'var(--header-height, 64px)'
        }}
        role="region"
        aria-label="Filter spacer"
      >
        <div className="px-4 sm:px-6 pt-2 pb-3">
          <div className="flex items-center h-8">
            <span className="text-white/50 text-sm backdrop-blur-md bg-[#1A1A1A]/70 rounded-lg px-3 py-2">No Active Filters</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      className="fixed z-25 left-0 right-0"
      style={{
        top: 'var(--header-height, 64px)'
      }}
      role="region"
      aria-label="Active filters"
    >
      <div className="px-4 sm:px-6 pt-2 pb-4">
        <div className="flex items-center justify-between">
          {/* Round X button for clear all */}
          <button
            onClick={onClearAll}
            className="flex-shrink-0 w-7 h-7 rounded-full backdrop-blur-md bg-[#1A1A1A]/70 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors mr-3 border border-white/10 hover:border-white/30"
            title="Clear All"
            aria-label={`Clear all ${totalActiveFilters} active filters`}
          >
            <BiX className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Selected filter tags */}
            <div className="flex flex-wrap gap-2 min-w-0 flex-1">
              {/* Genre filters with purple accent */}
              {selectedGenres.map((genre) => (
                <button
                  key={`genre-${genre}`}
                  onClick={() => onToggleGenre(genre)}
                  className="inline-flex items-center px-3 py-1 backdrop-blur-md bg-primary/90 text-white text-sm rounded-full hover:bg-primary-light transition-colors capitalize shadow-sm"
                  title={`Remove ${genre} genre filter`}
                  aria-label={`Remove ${genre} genre filter`}
                >
                  <span className="truncate max-w-32">{genre}</span>
                </button>
              ))}
              {/* Label filters with rose accent */}
              {selectedLabels.map((label) => (
                <button
                  key={`label-${label}`}
                  onClick={() => onToggleLabel(label)}
                  className="inline-flex items-center px-3 py-1 backdrop-blur-md bg-rose-400/90 text-white text-sm rounded-full hover:bg-rose-300 transition-colors shadow-sm"
                  title={`Remove ${label} label filter`}
                  aria-label={`Remove ${label} label filter`}
                >
                  <span className="truncate max-w-32">{label}</span>
                </button>
              ))}
              {/* Tag filters with orange accent */}
              {selectedTags.map((tag) => (
                <button
                  key={`tag-${tag}`}
                  onClick={() => onToggleTag(tag)}
                  className="inline-flex items-center px-3 py-1 backdrop-blur-md bg-orange-400/90 text-white text-sm rounded-full hover:bg-orange-400 transition-colors capitalize shadow-sm"
                  title={`Remove ${tag} tag filter`}
                  aria-label={`Remove ${tag} tag filter`}
                >
                  <span className="truncate max-w-32">{tag}</span>
                </button>
              ))}
              {/* Date range filter with fuchsia accent */}
              {hasDateFilter && releaseDateRange && (
                <button
                  onClick={onClearDateFilter}
                  className="inline-flex items-center px-3 py-1 backdrop-blur-md bg-fuchsia-400/90 text-white text-sm rounded-full hover:bg-fuchsia-400 transition-colors shadow-sm"
                  title="Remove release date filter"
                  aria-label="Remove release date filter"
                >
                  <span className="truncate max-w-32">
                    {releaseDateRange.min === releaseDateRange.max
                      ? releaseDateRange.min
                      : `${releaseDateRange.min} - ${releaseDateRange.max}`}
                  </span>
                </button>
              )}
              {/* Rating filter with amber accent */}
              {hasRatingFilter && ratingRange && (
                <button
                  onClick={onClearRatingFilter}
                  className="inline-flex items-center gap-1.5 px-3 py-1 backdrop-blur-md bg-amber-400/90 text-white text-sm rounded-full hover:bg-amber-400 transition-colors shadow-sm"
                  title="Remove rating filter"
                  aria-label="Remove rating filter"
                >
                  <BiStar className="text-base" style={{ fill: 'currentColor' }} />
                  <span className="truncate max-w-32">
                    {ratingRange.min === ratingRange.max
                      ? `${ratingRange.min.toFixed(1)} stars`
                      : `${ratingRange.min.toFixed(1)} - ${ratingRange.max.toFixed(1)}`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ActiveFiltersBar);