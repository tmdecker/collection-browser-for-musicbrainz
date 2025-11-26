/**
 * @ai-file hook
 * @ai-description Multi-category filter state management with localStorage persistence
 * @ai-dependencies React hooks, localStorage
 * @ai-features
 * - Manages genres, tags, labels, date ranges, and rating filters
 * - Filter panel visibility state
 * - Search within filter categories
 * - Persists all filter state across sessions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { GenreStat, extractGenreStats } from '@/utils/genre-processor';
import { LabelStat, extractLabelStats } from '@/utils/label-processor';
import { TagStat, extractTagStats } from '@/utils/tag-processor';
import { YearRange, getAvailableYearRange } from '@/utils/date-processor';
import { ReleaseGroup } from '@/types/music';

// Filter state interface - designed for extensibility
interface FilterState {
  selectedGenres: string[];
  selectedLabels: string[];
  selectedTags: string[];
  releaseDateRange: YearRange | null; // null means no date filter active
  ratingRange: { min: number; max: number } | null; // null means no rating filter active
  // Future filter types can be added here:
  // selectedReleaseTypes?: string[];
}

// Hook return type
interface UseFiltersReturn {
  // Stats for filtering
  genreStats: GenreStat[];
  labelStats: LabelStat[];
  tagStats: TagStat[];
  availableYearRange: YearRange | null;

  // Genre filtering
  selectedGenres: string[];
  toggleGenre: (genreName: string) => void;
  clearAllGenres: () => void;

  // Label filtering
  selectedLabels: string[];
  toggleLabel: (labelName: string) => void;
  clearAllLabels: () => void;

  // Tag filtering
  selectedTags: string[];
  toggleTag: (tagName: string) => void;
  clearAllTags: () => void;

  // Date range filtering
  releaseDateRange: YearRange | null;
  setReleaseDateRange: (range: YearRange | null) => void;
  clearDateFilter: () => void;

  // Rating range filtering
  ratingRange: { min: number; max: number } | null;
  setRatingRange: (range: { min: number; max: number } | null) => void;
  clearRatingFilter: () => void;

  // Filter panel state
  isFilterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean) => void;
  toggleFilterPanel: () => void;

  // Search within panel
  genreSearchQuery: string;
  setGenreSearchQuery: (query: string) => void;
  labelSearchQuery: string;
  setLabelSearchQuery: (query: string) => void;
  tagSearchQuery: string;
  setTagSearchQuery: (query: string) => void;

  // Utility
  hasActiveFilters: boolean;
  activeFilterCount: number;
  clearAllFilters: () => void;
}

// Default filter state
const defaultFilterState: FilterState = {
  selectedGenres: [],
  selectedLabels: [],
  selectedTags: [],
  releaseDateRange: null,
  ratingRange: null
};

// localStorage key for persisting filters
const FILTERS_STORAGE_KEY = 'mb-gui-filters';

export const useFilters = (albums: ReleaseGroup[]): UseFiltersReturn => {
  // Core filter state
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState);

  // UI state
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(false);
  const [genreSearchQuery, setGenreSearchQuery] = useState<string>('');
  const [labelSearchQuery, setLabelSearchQuery] = useState<string>('');
  const [tagSearchQuery, setTagSearchQuery] = useState<string>('');

  // Calculate stats from albums - always use official genres for genre filter
  const genreStats = useMemo(() => {
    return extractGenreStats(albums, true); // Always true for filter panel
  }, [albums]);

  const labelStats = useMemo(() => {
    return extractLabelStats(albums);
  }, [albums]);

  const tagStats = useMemo(() => {
    return extractTagStats(albums);
  }, [albums]);

  // Calculate available year range from albums
  const availableYearRange = useMemo(() => {
    return getAvailableYearRange(albums);
  }, [albums]);

  // Load persisted filters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedFilters = localStorage.getItem(FILTERS_STORAGE_KEY);
        if (savedFilters) {
          const parsed = JSON.parse(savedFilters);
          setFilterState(prevState => ({
            ...prevState,
            ...parsed
          }));
        }
      } catch (error) {
        console.warn('Failed to load saved filters:', error);
      }
    }
  }, []);

  // Persist filter changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filterState));
      } catch (error) {
        console.warn('Failed to save filters:', error);
      }
    }
  }, [filterState]);

  // Genre filter operations
  const toggleGenre = useCallback((genreName: string) => {
    setFilterState(prevState => {
      const currentGenres = prevState.selectedGenres;
      const isSelected = currentGenres.includes(genreName);

      return {
        ...prevState,
        selectedGenres: isSelected
          ? currentGenres.filter(g => g !== genreName)
          : [...currentGenres, genreName]
      };
    });
  }, []);

  const clearAllGenres = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      selectedGenres: []
    }));
  }, []);

  // Label filter operations
  const toggleLabel = useCallback((labelName: string) => {
    setFilterState(prevState => {
      const currentLabels = prevState.selectedLabels;
      const isSelected = currentLabels.includes(labelName);

      return {
        ...prevState,
        selectedLabels: isSelected
          ? currentLabels.filter(l => l !== labelName)
          : [...currentLabels, labelName]
      };
    });
  }, []);

  const clearAllLabels = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      selectedLabels: []
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterState({
      selectedGenres: [],
      selectedLabels: [],
      selectedTags: [],
      releaseDateRange: null,
      ratingRange: null
    });
  }, []);

  // Tag filter operations
  const toggleTag = useCallback((tagName: string) => {
    setFilterState(prevState => {
      const currentTags = prevState.selectedTags;
      const isSelected = currentTags.includes(tagName);

      return {
        ...prevState,
        selectedTags: isSelected
          ? currentTags.filter(t => t !== tagName)
          : [...currentTags, tagName]
      };
    });
  }, []);

  const clearAllTags = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      selectedTags: []
    }));
  }, []);

  // Date range filter operations
  const setReleaseDateRange = useCallback((range: YearRange | null) => {
    setFilterState(prevState => ({
      ...prevState,
      releaseDateRange: range
    }));
  }, []);

  const clearDateFilter = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      releaseDateRange: null
    }));
  }, []);

  // Rating range filter operations
  const setRatingRange = useCallback((range: { min: number; max: number } | null) => {
    setFilterState(prevState => ({
      ...prevState,
      ratingRange: range
    }));
  }, []);

  const clearRatingFilter = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      ratingRange: null
    }));
  }, []);

  // Filter panel operations
  const setFilterPanelOpen = useCallback((open: boolean) => {
    setIsFilterPanelOpen(open);
  }, []);

  const toggleFilterPanel = useCallback(() => {
    setIsFilterPanelOpen(prev => !prev);
  }, []);

  // Memoized computed values
  const hasActiveFilters = useMemo(() => {
    const hasDateFilter = filterState.releaseDateRange !== null &&
                          availableYearRange !== null &&
                          (filterState.releaseDateRange.min !== availableYearRange.min ||
                           filterState.releaseDateRange.max !== availableYearRange.max);
    const hasRatingFilter = filterState.ratingRange !== null;
    return filterState.selectedGenres.length > 0 ||
           filterState.selectedLabels.length > 0 ||
           filterState.selectedTags.length > 0 ||
           hasDateFilter ||
           hasRatingFilter;
    // Future: || filterState.selectedReleaseTypes?.length > 0 || etc.
  }, [filterState.selectedGenres, filterState.selectedLabels, filterState.selectedTags, filterState.releaseDateRange, filterState.ratingRange, availableYearRange]);

  const activeFilterCount = useMemo(() => {
    const hasDateFilter = filterState.releaseDateRange !== null &&
                          availableYearRange !== null &&
                          (filterState.releaseDateRange.min !== availableYearRange.min ||
                           filterState.releaseDateRange.max !== availableYearRange.max);
    const hasRatingFilter = filterState.ratingRange !== null;
    return filterState.selectedGenres.length +
           filterState.selectedLabels.length +
           filterState.selectedTags.length +
           (hasDateFilter ? 1 : 0) +
           (hasRatingFilter ? 1 : 0);
    // Future: + (filterState.selectedReleaseTypes?.length || 0) + etc.
  }, [filterState.selectedGenres, filterState.selectedLabels, filterState.selectedTags, filterState.releaseDateRange, filterState.ratingRange, availableYearRange]);

  return {
    // Stats for filtering
    genreStats,
    labelStats,
    tagStats,
    availableYearRange,

    // Genre filtering
    selectedGenres: filterState.selectedGenres,
    toggleGenre,
    clearAllGenres,

    // Label filtering
    selectedLabels: filterState.selectedLabels,
    toggleLabel,
    clearAllLabels,

    // Tag filtering
    selectedTags: filterState.selectedTags,
    toggleTag,
    clearAllTags,

    // Date range filtering
    releaseDateRange: filterState.releaseDateRange,
    setReleaseDateRange,
    clearDateFilter,

    // Rating range filtering
    ratingRange: filterState.ratingRange,
    setRatingRange,
    clearRatingFilter,

    // Filter panel state
    isFilterPanelOpen,
    setFilterPanelOpen,
    toggleFilterPanel,

    // Search within panel
    genreSearchQuery,
    setGenreSearchQuery,
    labelSearchQuery,
    setLabelSearchQuery,
    tagSearchQuery,
    setTagSearchQuery,

    // Utility
    hasActiveFilters,
    activeFilterCount,
    clearAllFilters
  };
};