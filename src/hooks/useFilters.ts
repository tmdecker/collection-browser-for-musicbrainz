/**
 * @ai-file hook
 * @ai-description Multi-category filter state management with localStorage persistence
 * @ai-dependencies React hooks, localStorage
 * @ai-features
 * - Manages genres, tags, labels, date ranges, and rating filters
 * - Filter panel visibility state
 * - Search within filter categories
 * - Persists filter state across sessions, separately for every collection and series, so a filter
 *   set in one collection never hides albums in another
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

// localStorage key for persisting filters: { [filterKey]: FilterState }, only collections with active filters
const FILTERS_STORAGE_KEY = 'mb-gui-filters-by-collection';
// Before 0.40 one set of filters applied to every collection; it is dropped, not guessed onto a collection
const LEGACY_FILTERS_STORAGE_KEY = 'mb-gui-filters';

type StoredFilters = Record<string, Partial<FilterState>>;

const readStoredFilters = (): StoredFilters => {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const isDefaultFilterState = (state: FilterState): boolean =>
  state.selectedGenres.length === 0 &&
  state.selectedLabels.length === 0 &&
  state.selectedTags.length === 0 &&
  state.releaseDateRange === null &&
  state.ratingRange === null;

type FilterUpdate = FilterState | ((prevState: FilterState) => FilterState);

/**
 * @param albums - Albums of the open collection (for the filter statistics)
 * @param filterKey - Which collection or series the filters belong to, e.g. 'collection:<mbid>'
 */
export const useFilters = (albums: ReleaseGroup[], filterKey: string): UseFiltersReturn => {
  // Core filter state, tagged with the collection it belongs to: right after switching collections the
  // old collection's filters are never shown or saved under the new one
  const [stored, setStored] = useState<{ key: string | null; filters: FilterState }>({ key: null, filters: defaultFilterState });
  const filterState = stored.key === filterKey ? stored.filters : defaultFilterState;
  const setFilterState = useCallback((update: FilterUpdate) => {
    setStored(prev => {
      const base = prev.key === filterKey ? prev.filters : defaultFilterState;
      return { key: filterKey, filters: typeof update === 'function' ? update(base) : update };
    });
  }, [filterKey]);

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

  // Load the persisted filters of this collection (after mount: localStorage does not exist during server rendering)
  useEffect(() => {
    let saved: Partial<FilterState> | undefined;
    try {
      localStorage.removeItem(LEGACY_FILTERS_STORAGE_KEY);
      saved = readStoredFilters()[filterKey];
    } catch (error) {
      console.warn('Failed to load saved filters:', error);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStored({ key: filterKey, filters: { ...defaultFilterState, ...saved } });
  }, [filterKey]);

  // Persist filter changes of this collection to localStorage
  useEffect(() => {
    if (stored.key === null) return;
    try {
      const all = readStoredFilters();
      if (isDefaultFilterState(stored.filters)) {
        delete all[stored.key];
      } else {
        all[stored.key] = stored.filters;
      }
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(all));
    } catch (error) {
      console.warn('Failed to save filters:', error);
    }
  }, [stored]);

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
  }, [setFilterState]);

  const clearAllGenres = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      selectedGenres: []
    }));
  }, [setFilterState]);

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
  }, [setFilterState]);

  const clearAllLabels = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      selectedLabels: []
    }));
  }, [setFilterState]);

  const clearAllFilters = useCallback(() => {
    setFilterState({
      selectedGenres: [],
      selectedLabels: [],
      selectedTags: [],
      releaseDateRange: null,
      ratingRange: null
    });
  }, [setFilterState]);

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
  }, [setFilterState]);

  const clearAllTags = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      selectedTags: []
    }));
  }, [setFilterState]);

  // Date range filter operations
  const setReleaseDateRange = useCallback((range: YearRange | null) => {
    setFilterState(prevState => ({
      ...prevState,
      releaseDateRange: range
    }));
  }, [setFilterState]);

  const clearDateFilter = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      releaseDateRange: null
    }));
  }, [setFilterState]);

  // Rating range filter operations
  const setRatingRange = useCallback((range: { min: number; max: number } | null) => {
    setFilterState(prevState => ({
      ...prevState,
      ratingRange: range
    }));
  }, [setFilterState]);

  const clearRatingFilter = useCallback(() => {
    setFilterState(prevState => ({
      ...prevState,
      ratingRange: null
    }));
  }, [setFilterState]);

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