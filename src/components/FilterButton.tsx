/**
 * @ai-file component
 * @ai-description Filter button that toggles filter panel visibility with active filter count badge
 * @ai-dependencies React, react-icons/bi
 * @ai-features
 * - Filter icon button matching SortDropdown design
 * - Shows red badge with count when filters are applied
 * - Toggles FilterPanel visibility on click
 * - Accessible with ARIA labels
 */

import React from 'react';
import { BiFilter } from 'react-icons/bi';

interface FilterButtonProps {
  isFilterPanelOpen: boolean;
  toggleFilterPanel: () => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  isFilterPanelOpen,
  toggleFilterPanel,
  activeFilterCount,
  hasActiveFilters
}) => {
  return (
    <div className="relative">
      {/* Filter Button */}
      <button
        onClick={toggleFilterPanel}
        className={`p-2 rounded-full backdrop-blur-md transition-colors flex items-center space-x-1 relative border ${
          isFilterPanelOpen
            ? 'bg-white/20 text-white border-white/35'
            : 'bg-[#1E1E1E]/75 hover:bg-white/20 text-white/75 hover:text-white border-white/15 hover:border-white/35'
        }`}
        title={`Filter albums${hasActiveFilters ? ` (${activeFilterCount} active)` : ''}`}
        aria-label={`Filter albums${hasActiveFilters ? `, ${activeFilterCount} filters active` : ''}`}
        aria-expanded={isFilterPanelOpen}
        aria-haspopup="true"
      >
        {/* Filter Icon */}
        <BiFilter size={24} />

        {/* Active filter count badge */}
        {hasActiveFilters && (
          <div className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {activeFilterCount}
          </div>
        )}
      </button>
    </div>
  );
};

export default FilterButton;