/**
 * @ai-file component
 * @ai-description Multi-category filter panel with genres, tags, labels, dates, and ratings
 * @ai-dependencies React, genre/label/tag processors, RatingFilterSection, react-icons
 * @ai-features
 * - Horizontal category tabs with color-coded active states (purple/orange/rose/fuchsia)
 * - Multiple selection with OR logic within categories, AND logic between categories
 * - Collapsible search bars per category
 * - Double range slider for release dates and ratings
 * - Floating chevron toggle for long lists (>25 items)
 * - Glass morphism styling with smooth animations
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { GenreStat, filterGenresBySearch } from '@/utils/genre-processor';
import { LabelStat, filterLabelsBySearch } from '@/utils/label-processor';
import { TagStat, filterTagsBySearch } from '@/utils/tag-processor';
import { YearRange } from '@/utils/date-processor';
import { BiSearch, BiChevronDown, BiChevronUp, BiPurchaseTag, BiBuilding, BiCalendar, BiStar } from 'react-icons/bi';
import { LuGuitar } from 'react-icons/lu';
import RatingFilterSection from './RatingFilterSection';

interface FilterPanelProps {
  isOpen: boolean;
  genreStats: GenreStat[];
  labelStats: LabelStat[];
  tagStats: TagStat[];
  availableYearRange: YearRange | null;
  selectedGenres: string[];
  selectedLabels: string[];
  selectedTags: string[];
  releaseDateRange: YearRange | null;
  ratingRange: { min: number; max: number } | null;
  genreSearchQuery: string;
  labelSearchQuery: string;
  tagSearchQuery: string;
  enableLabelFilter: boolean;
  onGenreSearchChange: (query: string) => void;
  onLabelSearchChange: (query: string) => void;
  onTagSearchChange: (query: string) => void;
  onToggleGenre: (genreName: string) => void;
  onToggleLabel: (labelName: string) => void;
  onToggleTag: (tagName: string) => void;
  onReleaseDateRangeChange: (range: YearRange | null) => void;
  onRatingRangeChange: (range: { min: number; max: number } | null) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  genreStats,
  labelStats,
  tagStats,
  availableYearRange,
  selectedGenres,
  selectedLabels,
  selectedTags,
  releaseDateRange,
  ratingRange,
  genreSearchQuery,
  labelSearchQuery,
  tagSearchQuery,
  enableLabelFilter,
  onGenreSearchChange,
  onLabelSearchChange,
  onTagSearchChange,
  onToggleGenre,
  onToggleLabel,
  onToggleTag,
  onReleaseDateRangeChange,
  onRatingRangeChange,
  onClearAll,
  onClose
}) => {
  const [activeCategory, setActiveCategory] = useState<'genres' | 'labels' | 'tags' | 'dates' | 'rating'>('genres');
  const [isHovered, setIsHovered] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [chevronPosition, setChevronPosition] = useState(0);
  const [tempMinYear, setTempMinYear] = useState<string>('');
  const [tempMaxYear, setTempMaxYear] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Filter genres based on search query
  const filteredGenres = useMemo(() => {
    return filterGenresBySearch(genreStats || [], genreSearchQuery);
  }, [genreStats, genreSearchQuery]);

  // Filter labels based on search query
  const filteredLabels = useMemo(() => {
    return filterLabelsBySearch(labelStats || [], labelSearchQuery);
  }, [labelStats, labelSearchQuery]);

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    return filterTagsBySearch(tagStats || [], tagSearchQuery);
  }, [tagStats, tagSearchQuery]);

  // Limit displayed items for performance
  const displayedGenres = useMemo(() => {
    return showAllGenres ? filteredGenres : (filteredGenres?.slice(0, 25) || []);
  }, [filteredGenres, showAllGenres]);

  const displayedLabels = useMemo(() => {
    return showAllLabels ? filteredLabels : (filteredLabels?.slice(0, 25) || []);
  }, [filteredLabels, showAllLabels]);

  const displayedTags = useMemo(() => {
    return showAllTags ? filteredTags : (filteredTags?.slice(0, 25) || []);
  }, [filteredTags, showAllTags]);

  // Count available items
  const genreCount = genreStats?.length || 0;
  const labelCount = labelStats?.length || 0;
  const tagCount = tagStats?.length || 0;

  // Get current search query based on active category
  const currentSearchQuery = activeCategory === 'genres' ? genreSearchQuery :
                              activeCategory === 'labels' ? labelSearchQuery :
                              activeCategory === 'tags' ? tagSearchQuery :
                              '';

  // Initialize temp year values when date range or available range changes
  useEffect(() => {
    if (availableYearRange) {
      const currentRange = releaseDateRange || availableYearRange;
      setTempMinYear(currentRange.min.toString());
      setTempMaxYear(currentRange.max.toString());
    }
  }, [releaseDateRange, availableYearRange]);

  // Handle slider changes
  const handleSliderChange = (min: number, max: number) => {
    setTempMinYear(min.toString());
    setTempMaxYear(max.toString());
    onReleaseDateRangeChange({ min, max });
  };

  // Handle manual year input
  const handleMinYearChange = (value: string) => {
    setTempMinYear(value);
  };

  const handleMaxYearChange = (value: string) => {
    setTempMaxYear(value);
  };

  const handleMinYearBlur = () => {
    if (!availableYearRange) return;
    const year = parseInt(tempMinYear, 10);
    if (!isNaN(year) && year >= availableYearRange.min && year <= (releaseDateRange?.max || availableYearRange.max)) {
      onReleaseDateRangeChange({ min: year, max: releaseDateRange?.max || availableYearRange.max });
    } else {
      setTempMinYear((releaseDateRange?.min || availableYearRange.min).toString());
    }
  };

  const handleMaxYearBlur = () => {
    if (!availableYearRange) return;
    const year = parseInt(tempMaxYear, 10);
    if (!isNaN(year) && year <= availableYearRange.max && year >= (releaseDateRange?.min || availableYearRange.min)) {
      onReleaseDateRangeChange({ min: releaseDateRange?.min || availableYearRange.min, max: year });
    } else {
      setTempMaxYear((releaseDateRange?.max || availableYearRange.max).toString());
    }
  };

  // Track mouse position for hover-based z-index switching
  const [mouseX, setMouseX] = useState<number | null>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // Check if both sliders are at the same year (for z-index handling)
  const isSameYear = releaseDateRange?.min === releaseDateRange?.max;

  // Calculate z-index based on mouse position when thumbs overlap
  const getSliderZIndices = () => {
    if (!isSameYear || mouseX === null || !sliderContainerRef.current) {
      // Normal case: max on top
      return { minZ: 3, maxZ: 4 };
    }

    // Get the position of the overlapping thumbs
    const container = sliderContainerRef.current;
    const rect = container.getBoundingClientRect();
    const currentYear = releaseDateRange?.min || availableYearRange?.min || 0;
    const range = (availableYearRange?.max || 0) - (availableYearRange?.min || 0);
    const thumbPosition = ((currentYear - (availableYearRange?.min || 0)) / range) * rect.width;

    // If mouse is left of thumb center, bring min to top; if right, bring max to top
    if (mouseX < rect.left + thumbPosition) {
      return { minZ: 4, maxZ: 3 }; // Min on top (for dragging left)
    } else {
      return { minZ: 3, maxZ: 4 }; // Max on top (for dragging right)
    }
  };

  const { minZ: minSliderZIndex, maxZ: maxSliderZIndex } = getSliderZIndices();

  // Track mouse movement over the slider container
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSameYear) {
      setMouseX(e.clientX);
    }
  };

  const handleMouseLeave = () => {
    setMouseX(null);
  };


  // Close search when clicking outside if no text has been entered
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        // Also check if click is not on the search toggle button
        const target = event.target as HTMLElement;
        if (!target.closest('[aria-label="Open search"]')) {
          // Close search only if no text has been entered
          if (isSearchOpen && !currentSearchQuery) {
            setIsSearchOpen(false);
          }
        }
      }
    };

    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen, currentSearchQuery]);

  // Focus search input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close search when category changes
  useEffect(() => {
    setIsSearchOpen(false);
    // Reset "show all" state when switching categories
    setShowAllGenres(false);
    setShowAllLabels(false);
    setShowAllTags(false);
    // Clear search query when switching categories
    if (activeCategory === 'genres') {
      onLabelSearchChange('');
      onTagSearchChange('');
    } else if (activeCategory === 'labels') {
      onGenreSearchChange('');
      onTagSearchChange('');
    } else if (activeCategory === 'tags') {
      onGenreSearchChange('');
      onLabelSearchChange('');
    } else if (activeCategory === 'dates') {
      onGenreSearchChange('');
      onLabelSearchChange('');
      onTagSearchChange('');
    }
  }, [activeCategory, onGenreSearchChange, onLabelSearchChange, onTagSearchChange]);

  // Reset "show all" state when search query changes
  useEffect(() => {
    if (genreSearchQuery) setShowAllGenres(false);
  }, [genreSearchQuery]);

  useEffect(() => {
    if (labelSearchQuery) setShowAllLabels(false);
  }, [labelSearchQuery]);

  useEffect(() => {
    if (tagSearchQuery) setShowAllTags(false);
  }, [tagSearchQuery]);

  // Calculate chevron button position based on filter panel height
  useEffect(() => {
    const updateChevronPosition = () => {
      if (filterPanelRef.current) {
        const rect = filterPanelRef.current.getBoundingClientRect();
        setChevronPosition(rect.bottom);
      }
    };

    updateChevronPosition();
    window.addEventListener('resize', updateChevronPosition);
    window.addEventListener('scroll', updateChevronPosition);

    return () => {
      window.removeEventListener('resize', updateChevronPosition);
      window.removeEventListener('scroll', updateChevronPosition);
    };
  }, [isOpen, activeCategory, showAllGenres, showAllLabels, showAllTags, genreSearchQuery, labelSearchQuery, tagSearchQuery]);

  if (!isOpen) {
    return null;
  }

  // Get current category info
  const categoryName = activeCategory === 'genres' ? 'Genres' :
                       activeCategory === 'labels' ? 'Record Labels' :
                       activeCategory === 'tags' ? 'Tags' :
                       activeCategory === 'dates' ? 'Release Date' :
                       'Rating';
  const handleSearchChange = activeCategory === 'genres' ? onGenreSearchChange :
                             activeCategory === 'labels' ? onLabelSearchChange :
                             activeCategory === 'tags' ? onTagSearchChange :
                             () => {};

  // Calculate button position based on screen size
  // FilterPanel is always positioned at header + 48px (ActiveFiltersBar height)
  // So we need to add baseOffset to that position
  const getButtonTop = () => {
    const baseOffset = 12; // Mobile/tablet offset from FilterPanel top
    return `calc(var(--header-height, 64px) + 48px + ${baseOffset}px)`;
  };

  const getButtonTopLg = () => {
    const lgOffset = 12; // Large screen offset from FilterPanel top
    return `calc(var(--header-height, 64px) + 48px + ${lgOffset}px)`;
  };

  return (
    <div
      className="fixed z-20 px-2 sm:px-3 left-0 right-0"
      style={{
        top: 'calc(var(--header-height, 64px) + var(--active-filters-height, 0px))', // Account for ActiveFiltersBar height
      }}
    >
      {/* Floating close button - positioned relative to sticky container */}
      <button
        onClick={onClose}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`absolute right-4 sm:right-6 top-2 sm:top-3 z-30 p-1.5 rounded-full bg-background-tertiary/90 text-text-secondary transition-all shadow-lg backdrop-blur-sm lg:opacity-0 lg:pointer-events-none hover:bg-background hover:text-text-primary hover:scale-110 ${isHovered ? 'lg:!opacity-100 lg:!pointer-events-auto' : ''}`}
        aria-label="Close filter panel"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>


        <div
          ref={filterPanelRef}
          className="bg-background-secondary rounded-3xl border border-white/10"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            background: 'linear-gradient(180deg, rgba(26,26,26,0.98) 0%, rgba(26,26,26,0.95) 100%)',
            backdropFilter: 'blur(8px) saturate(1.2)',
            boxShadow: '0 1px 3px rgba(18,18,18,0.12), 0 1px 2px rgba(18,18,18,0.24)'
          }}
          role="region"
          aria-label="Filter panel"
        >
        <div className="px-4 sm:px-6 py-3 relative">

        {/* Horizontal scope/category bar with inline search */}
        <div className="flex items-center gap-2 mb-4">
          {/* Category selector bar */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-[#2A2A2A]/60 backdrop-blur-md border border-white/10 flex-shrink-0">
            <button
              onClick={() => setActiveCategory('genres')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-sm font-medium whitespace-nowrap ${
                activeCategory === 'genres'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.07]'
              }`}
              aria-label="Filter by genres"
              title={`Genres (${genreCount})`}
            >
              <LuGuitar className="w-4 h-4" />
              <span className="hidden sm:inline">Genres</span>
            </button>
            <button
              onClick={() => setActiveCategory('tags')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-sm font-medium whitespace-nowrap ${
                activeCategory === 'tags'
                  ? 'bg-orange-400 text-white shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.07]'
              }`}
              aria-label="Filter by tags"
              title={`Tags (${tagCount})`}
            >
              <BiPurchaseTag className="w-4 h-4" />
              <span className="hidden sm:inline">Tags</span>
            </button>
            {enableLabelFilter && (
              <button
                onClick={() => setActiveCategory('labels')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-sm font-medium whitespace-nowrap ${
                  activeCategory === 'labels'
                    ? 'bg-rose-400 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.07]'
                }`}
                aria-label="Filter by record labels"
                title={`Record Labels (${labelCount})`}
              >
                <BiBuilding className="w-4 h-4" />
                <span className="hidden sm:inline">Labels</span>
              </button>
            )}
            <button
              onClick={() => setActiveCategory('dates')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-sm font-medium whitespace-nowrap ${
                activeCategory === 'dates'
                  ? 'bg-fuchsia-400 text-white shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.07]'
              }`}
              aria-label="Filter by release date"
              title="Release Date"
            >
              <BiCalendar className="w-4 h-4" />
              <span className="hidden sm:inline">Date</span>
            </button>
            <button
              onClick={() => setActiveCategory('rating')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-sm font-medium whitespace-nowrap ${
                activeCategory === 'rating'
                  ? 'bg-amber-400 text-white shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.07]'
              }`}
              aria-label="Filter by rating"
              title="Rating"
            >
              <BiStar className="w-4 h-4" />
              <span className="hidden sm:inline">Rating</span>
            </button>
          </div>

          {/* Inline expandable search - hide for dates category */}
          {activeCategory !== 'dates' && (
            <div className="flex items-center">
              {!isSearchOpen ? (
                // Search icon button when closed
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 pl-3 rounded-full transition-all text-white/50 hover:text-white/70 hover:bg-[#2A2A2A]/60"
                  aria-label="Open search"
                >
                  <BiSearch className="w-5 h-5" />
                </button>
              ) : (
                // Expanded search bar
                <div className="relative animate-in slide-in-from-left-2 fade-in duration-200">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={currentSearchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={`Search in ${categoryName}...`}
                    className="w-80 px-4 py-2 pl-10 rounded-lg bg-[#2A2A2A]/80 backdrop-blur-md text-sm text-white placeholder:text-white/50 focus:outline-none focus:bg-[#2A2A2A]/90 transition-colors"
                    aria-label={`Search ${categoryName.toLowerCase()}`}
                  />
                  <BiSearch className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 z-10" />
                  {currentSearchQuery && (
                    <button
                      onClick={() => handleSearchChange('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                      aria-label="Clear search"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className={activeCategory === 'dates' || activeCategory === 'rating' ? '' : 'max-h-64 overflow-y-auto'}>
          {activeCategory === 'genres' && (
            <div
              id="genres-panel"
              role="tabpanel"
              aria-labelledby="genres-category"
            >
              {displayedGenres.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-white/70">
                    {genreSearchQuery ? 'No genres found matching your search.' : 'No genres available.'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  {displayedGenres.map((genre) => {
                    const isSelected = selectedGenres.includes(genre.name);

                    return (
                      <button
                        key={genre.name}
                        onClick={() => onToggleGenre(genre.name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 backdrop-blur-md ${
                          isSelected
                            ? 'bg-primary/90 hover:bg-primary text-white shadow-sm'
                            : 'bg-[#2A2A2A]/80 hover:bg-[#2A2A2A]/95 text-white'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                        title={`${isSelected ? 'Remove' : 'Add'} ${genre.name} filter`}
                      >
                        <span className="text-sm capitalize">{genre.name}</span>
                        <span className={`text-xs ${isSelected ? 'text-white/90' : 'text-white/50'}`}>
                          {genre.count}
                        </span>
                      </button>
                    );
                  })}
                  {filteredGenres.length > 25 && (
                    <span className="text-white/50 text-xs ml-2">
                      {showAllGenres
                        ? `Showing all ${filteredGenres.length} genres`
                        : `Showing ${displayedGenres.length} of ${filteredGenres.length} genres`
                      }
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {enableLabelFilter && activeCategory === 'labels' && (
            <div
              id="labels-panel"
              role="tabpanel"
              aria-labelledby="labels-category"
            >
              {displayedLabels.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-white/70">
                    {labelSearchQuery ? 'No labels found matching your search.' : 'No labels available.'}
                  </p>
                  {labelCount === 0 && (
                    <p className="text-xs text-white/50 mt-2">
                      Labels are only available for albums with fetched release details.<br/>
                      Click on albums to view their details and populate label data.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  {displayedLabels.map((label) => {
                    const isSelected = selectedLabels.includes(label.name);

                    return (
                      <button
                        key={label.name}
                        onClick={() => onToggleLabel(label.name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 backdrop-blur-md ${
                          isSelected
                            ? 'bg-rose-400/90 hover:bg-rose-400 text-white shadow-sm'
                            : 'bg-[#2A2A2A]/80 hover:bg-[#2A2A2A]/95 text-white'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                        title={`${isSelected ? 'Remove' : 'Add'} ${label.name} filter`}
                      >
                        <span className="text-sm">{label.name}</span>
                        <span className={`text-xs ${isSelected ? 'text-white/90' : 'text-white/50'}`}>
                          {label.count}
                        </span>
                      </button>
                    );
                  })}
                  {filteredLabels.length > 25 && (
                    <span className="text-white/50 text-xs ml-2">
                      {showAllLabels
                        ? `Showing all ${filteredLabels.length} labels`
                        : `Showing ${displayedLabels.length} of ${filteredLabels.length} labels`
                      }
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeCategory === 'tags' && (
            <div
              id="tags-panel"
              role="tabpanel"
              aria-labelledby="tags-category"
            >
              {displayedTags.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-white/70">
                    {tagSearchQuery ? 'No tags found matching your search.' : 'No tags available.'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  {displayedTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.name);

                    return (
                      <button
                        key={tag.name}
                        onClick={() => onToggleTag(tag.name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 backdrop-blur-md ${
                          isSelected
                            ? 'bg-orange-400/90 hover:bg-orange-400 text-white shadow-sm'
                            : 'bg-[#2A2A2A]/80 hover:bg-[#2A2A2A]/95 text-white'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                        title={`${isSelected ? 'Remove' : 'Add'} ${tag.name} filter`}
                      >
                        <span className="text-sm capitalize">{tag.name}</span>
                        <span className={`text-xs ${isSelected ? 'text-white/90' : 'text-white/50'}`}>
                          {tag.count}
                        </span>
                      </button>
                    );
                  })}
                  {filteredTags.length > 25 && (
                    <span className="text-white/50 text-xs ml-2">
                      {showAllTags
                        ? `Showing all ${filteredTags.length} tags`
                        : `Showing ${displayedTags.length} of ${filteredTags.length} tags`
                      }
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeCategory === 'dates' && (
            <div
              id="dates-panel"
              role="tabpanel"
              aria-labelledby="dates-category"
              className="pb-2"
            >
              {!availableYearRange ? (
                <div className="text-center py-8">
                  <p className="text-sm text-white/70">No release dates available.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Double range slider with year inputs */}
                  <div className="flex items-center gap-3">
                    {/* Min year input */}
                    <input
                      type="text"
                      value={tempMinYear}
                      onChange={(e) => handleMinYearChange(e.target.value)}
                      onBlur={handleMinYearBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleMinYearBlur();
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-16 px-2 py-1.5 rounded-lg bg-[#1A1A1A]/90 backdrop-blur-md text-sm text-white text-center border border-white/10 hover:border-white/20 hover:bg-[#2A2A2A]/90 focus:outline-none focus:border-fuchsia-400/50 focus:ring-1 focus:ring-fuchsia-400/30 transition-all flex-shrink-0"
                      aria-label="Minimum year"
                    />

                    {/* Slider container */}
                    <div className="relative flex-1 py-3 flex items-center">
                      <div
                        ref={sliderContainerRef}
                        className="relative w-full h-2"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                      >
                        <input
                        type="range"
                        min={availableYearRange.min}
                        max={availableYearRange.max}
                        value={releaseDateRange?.min || availableYearRange.min}
                        onChange={(e) => {
                          const newMin = parseInt(e.target.value, 10);
                          const currentMax = releaseDateRange?.max || availableYearRange.max;
                          if (newMin <= currentMax) {
                            handleSliderChange(newMin, currentMax);
                          }
                        }}
                        className={`absolute w-full h-2 bg-transparent appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fuchsia-400 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-transparent [&::-webkit-slider-thumb]:hover:border-fuchsia-300 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-all [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-fuchsia-400 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-transparent [&::-moz-range-thumb]:hover:border-fuchsia-300 ${isSameYear ? '[&::-webkit-slider-thumb]:translate-x-[-2px] [&::-moz-range-thumb]:translate-x-[-2px]' : ''}`}
                        style={{ zIndex: minSliderZIndex }}
                        aria-label="Minimum year slider"
                        />
                        <input
                        type="range"
                        min={availableYearRange.min}
                        max={availableYearRange.max}
                        value={releaseDateRange?.max || availableYearRange.max}
                        onChange={(e) => {
                          const newMax = parseInt(e.target.value, 10);
                          const currentMin = releaseDateRange?.min || availableYearRange.min;
                          if (newMax >= currentMin) {
                            handleSliderChange(currentMin, newMax);
                          }
                        }}
                        className={`absolute w-full h-2 bg-transparent appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fuchsia-400 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-transparent [&::-webkit-slider-thumb]:hover:border-fuchsia-300 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-all [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-fuchsia-400 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-transparent [&::-moz-range-thumb]:hover:border-fuchsia-300 ${isSameYear ? '[&::-webkit-slider-thumb]:translate-x-[2px] [&::-moz-range-thumb]:translate-x-[2px]' : ''}`}
                        style={{ zIndex: maxSliderZIndex }}
                        aria-label="Maximum year slider"
                        />
                        {/* Slider track background */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-[#2A2A2A]/80 rounded-full border border-white/10 overflow-hidden">
                          {/* Active range highlight */}
                          <div
                            className="absolute h-full bg-fuchsia-400/60 transition-all"
                            style={{
                              left: `${((releaseDateRange?.min || availableYearRange.min) - availableYearRange.min) / (availableYearRange.max - availableYearRange.min) * 100}%`,
                              right: `${100 - ((releaseDateRange?.max || availableYearRange.max) - availableYearRange.min) / (availableYearRange.max - availableYearRange.min) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Max year input */}
                    <input
                      type="text"
                      value={tempMaxYear}
                      onChange={(e) => handleMaxYearChange(e.target.value)}
                      onBlur={handleMaxYearBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleMaxYearBlur();
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-16 px-2 py-1.5 rounded-lg bg-[#1A1A1A]/90 backdrop-blur-md text-sm text-white text-center border border-white/10 hover:border-white/20 hover:bg-[#2A2A2A]/90 focus:outline-none focus:border-fuchsia-400/50 focus:ring-1 focus:ring-fuchsia-400/30 transition-all flex-shrink-0"
                      aria-label="Maximum year"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeCategory === 'rating' && (
            <div
              id="rating-panel"
              role="tabpanel"
              aria-labelledby="rating-category"
              className="pb-2"
            >
              <RatingFilterSection
                ratingRange={ratingRange}
                setRatingRange={onRatingRangeChange}
              />
            </div>
          )}
        </div>
        </div>
        </div>

      {/* Floating chevron toggle button - positioned on bottom border, only show on hover */}
      {((activeCategory === 'genres' && filteredGenres.length > 25) ||
        (activeCategory === 'labels' && filteredLabels.length > 25) ||
        (activeCategory === 'tags' && filteredTags.length > 25)) && (
        <button
          onClick={() => {
            if (activeCategory === 'genres') setShowAllGenres(!showAllGenres);
            else if (activeCategory === 'labels') setShowAllLabels(!showAllLabels);
            else setShowAllTags(!showAllTags);
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`fixed left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 p-1.5 rounded-full bg-background-tertiary/90 text-text-secondary transition-all shadow-lg backdrop-blur-sm opacity-0 pointer-events-none hover:bg-background hover:text-text-primary hover:scale-110 ${isHovered ? '!opacity-100 !pointer-events-auto' : ''}`}
          style={{
            top: `${chevronPosition}px`
          }}
          aria-label={(activeCategory === 'genres' && showAllGenres) || (activeCategory === 'labels' && showAllLabels) || (activeCategory === 'tags' && showAllTags) ? 'Show less' : 'Show all'}
          title={(activeCategory === 'genres' && showAllGenres) || (activeCategory === 'labels' && showAllLabels) || (activeCategory === 'tags' && showAllTags) ? 'Show less items' : 'Show all items'}
        >
          {((activeCategory === 'genres' && showAllGenres) ||
            (activeCategory === 'labels' && showAllLabels) ||
            (activeCategory === 'tags' && showAllTags)) ? (
            <BiChevronUp className="w-5 h-5" />
          ) : (
            <BiChevronDown className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  );
};

export default React.memo(FilterPanel);