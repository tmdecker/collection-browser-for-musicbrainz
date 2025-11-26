/**
 * @ai-file component
 * @ai-description Rating filter section with double range slider (0-5 stars)
 * @ai-dependencies React, react-icons/bi
 * @ai-features
 * - Double range slider with 0.5 step granularity
 * - Manual input fields for min/max values
 * - Star icons at ends with amber/yellow color theme
 * - Consistent design with DateFilterSection
 */

import React, { useState, useEffect, useRef } from 'react';
import { BiStar, BiX } from 'react-icons/bi';

interface RatingFilterSectionProps {
  ratingRange: { min: number; max: number } | null;
  setRatingRange: (range: { min: number; max: number } | null) => void;
}

const RatingFilterSection: React.FC<RatingFilterSectionProps> = ({
  ratingRange,
  setRatingRange,
}) => {
  // Default range: 0-5 stars
  const defaultMin = 0;
  const defaultMax = 5;

  // Local state for input fields
  const [tempMinRating, setTempMinRating] = useState<string>(
    ratingRange?.min.toFixed(1) || defaultMin.toFixed(1)
  );
  const [tempMaxRating, setTempMaxRating] = useState<string>(
    ratingRange?.max.toFixed(1) || defaultMax.toFixed(1)
  );

  // Refs for tracking thumb hover
  const minThumbRef = useRef<HTMLDivElement>(null);
  const maxThumbRef = useRef<HTMLDivElement>(null);
  const [activeThumb, setActiveThumb] = useState<'min' | 'max' | null>(null);

  // Get current values
  const minRating = ratingRange?.min ?? defaultMin;
  const maxRating = ratingRange?.max ?? defaultMax;

  // Update temp values when prop changes
  useEffect(() => {
    setTempMinRating(minRating.toFixed(1));
    setTempMaxRating(maxRating.toFixed(1));
  }, [minRating, maxRating]);

  // Handle slider change for min
  const handleMinSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = parseFloat(e.target.value);
    const newMax = Math.max(newMin, maxRating);
    setRatingRange({ min: newMin, max: newMax });
  };

  // Handle slider change for max
  const handleMaxSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = parseFloat(e.target.value);
    const newMin = Math.min(minRating, newMax);
    setRatingRange({ min: newMin, max: newMax });
  };

  // Handle manual input for min
  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempMinRating(e.target.value);
  };

  const handleMinInputBlur = () => {
    const parsed = parseFloat(tempMinRating);
    if (!isNaN(parsed)) {
      const clamped = Math.max(defaultMin, Math.min(parsed, maxRating));
      setRatingRange({ min: clamped, max: maxRating });
      setTempMinRating(clamped.toFixed(1));
    } else {
      setTempMinRating(minRating.toFixed(1));
    }
  };

  const handleMinInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleMinInputBlur();
    }
  };

  // Handle manual input for max
  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempMaxRating(e.target.value);
  };

  const handleMaxInputBlur = () => {
    const parsed = parseFloat(tempMaxRating);
    if (!isNaN(parsed)) {
      const clamped = Math.max(minRating, Math.min(parsed, defaultMax));
      setRatingRange({ min: minRating, max: clamped });
      setTempMaxRating(clamped.toFixed(1));
    } else {
      setTempMaxRating(maxRating.toFixed(1));
    }
  };

  const handleMaxInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleMaxInputBlur();
    }
  };

  // Clear filter
  const handleClearFilter = () => {
    setRatingRange(null);
    setTempMinRating(defaultMin.toFixed(1));
    setTempMaxRating(defaultMax.toFixed(1));
  };

  // Calculate positions for slider track highlighting
  const minPercent = (minRating / defaultMax) * 100;
  const maxPercent = (maxRating / defaultMax) * 100;

  // Determine thumb z-index based on overlap
  const thumbsOverlap = minRating === maxRating;

  return (
    <div className="space-y-6 py-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-text-primary">Rating</h3>
        {ratingRange && (minRating !== defaultMin || maxRating !== defaultMax) && (
          <button
            onClick={handleClearFilter}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            <BiX className="text-base" />
            Clear
          </button>
        )}
      </div>

      {/* Slider container */}
      <div className="px-2">
        {/* Input fields */}
        <div className="flex items-center justify-between mb-6">
          {/* Min input */}
          <div className="flex items-center gap-2">
            <BiStar className="text-amber-400 text-lg" />
            <input
              type="number"
              value={tempMinRating}
              onChange={handleMinInputChange}
              onBlur={handleMinInputBlur}
              onKeyDown={handleMinInputKeyDown}
              min={defaultMin}
              max={defaultMax}
              step={0.5}
              className="w-16 px-2 py-1 text-sm text-center rounded bg-background-tertiary text-text-primary border border-white/10 hover:bg-background focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          {/* Separator */}
          <div className="text-text-tertiary text-sm">to</div>

          {/* Max input */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={tempMaxRating}
              onChange={handleMaxInputChange}
              onBlur={handleMaxInputBlur}
              onKeyDown={handleMaxInputKeyDown}
              min={defaultMin}
              max={defaultMax}
              step={0.5}
              className="w-16 px-2 py-1 text-sm text-center rounded bg-background-tertiary text-text-primary border border-white/10 hover:bg-background focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <BiStar className="text-amber-400 text-lg" style={{ fill: 'currentColor' }} />
          </div>
        </div>

        {/* Double range slider */}
        <div className="relative h-10">
          {/* Background track */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-700 rounded-full transform -translate-y-1/2" />

          {/* Active track highlight */}
          <div
            className="absolute top-1/2 h-1 bg-amber-400 rounded-full transform -translate-y-1/2"
            style={{
              left: `${minPercent}%`,
              right: `${100 - maxPercent}%`,
            }}
          />

          {/* Min slider */}
          <input
            type="range"
            min={defaultMin}
            max={defaultMax}
            step={0.5}
            value={minRating}
            onChange={handleMinSliderChange}
            onMouseEnter={() => setActiveThumb('min')}
            onMouseLeave={() => setActiveThumb(null)}
            className="absolute top-0 left-0 w-full h-full appearance-none bg-transparent cursor-pointer pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
            style={{
              zIndex: thumbsOverlap && activeThumb !== 'max' ? 2 : 1,
            }}
          />

          {/* Max slider */}
          <input
            type="range"
            min={defaultMin}
            max={defaultMax}
            step={0.5}
            value={maxRating}
            onChange={handleMaxSliderChange}
            onMouseEnter={() => setActiveThumb('max')}
            onMouseLeave={() => setActiveThumb(null)}
            className="absolute top-0 left-0 w-full h-full appearance-none bg-transparent cursor-pointer pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
            style={{
              zIndex: thumbsOverlap && activeThumb === 'max' ? 2 : 1,
            }}
          />

          <style jsx>{`
            input[type='range']::-webkit-slider-thumb {
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: rgb(251, 191, 36);
              border: 2px solid rgb(18, 18, 18);
              cursor: pointer;
              transition: all 0.15s ease;
            }

            input[type='range']::-webkit-slider-thumb:hover {
              background: rgb(252, 211, 77);
              border-color: rgb(252, 211, 77);
              box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.2);
            }

            input[type='range']::-moz-range-thumb {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: rgb(251, 191, 36);
              border: 2px solid rgb(18, 18, 18);
              cursor: pointer;
              transition: all 0.15s ease;
            }

            input[type='range']::-moz-range-thumb:hover {
              background: rgb(252, 211, 77);
              border-color: rgb(252, 211, 77);
              box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.2);
            }
          `}</style>
        </div>

        {/* Range display */}
        <div className="mt-4 text-center text-sm text-text-tertiary">
          {minRating === maxRating ? (
            <span>Exactly {minRating.toFixed(1)} stars</span>
          ) : (
            <span>
              {minRating.toFixed(1)} - {maxRating.toFixed(1)} stars
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RatingFilterSection;
