/**
 * @ai-file component
 * @ai-description Star rating display component for album ratings
 * @ai-dependencies React, react-icons/bi
 * @ai-features
 * - Display 0-5 star ratings with fractional rendering
 * - Show vote count for average ratings or "(You)" indicator for personal ratings
 * - Size variants: sm, md, lg
 * - Tooltip with exact rating value
 */

import React from 'react';
import { BiStar, BiSolidStar, BiSolidStarHalf } from 'react-icons/bi';
import { formatRatingDisplay } from '@/utils/ratings';

interface StarRatingProps {
  rating: number | null;        // 0-5 scale (5-star rating)
  mode: 'average' | 'personal'; // Display mode
  count?: number;               // Vote count (for average mode)
  size?: 'sm' | 'md' | 'lg';   // Size variant
  className?: string;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  mode,
  count,
  size = 'md',
  className = '',
}) => {
  // Convert rating to stars and round to nearest 0.5
  const rawStars = rating;
  const stars = rawStars !== null ? Math.round(rawStars * 2) / 2 : null;

  // Handle empty state
  if (stars === null) {
    if (mode === 'personal') {
      return (
        <div className={`text-text-tertiary italic text-sm ${className}`}>
          You haven't rated this album yet
        </div>
      );
    }
    return (
      <div className={`text-text-tertiary italic text-sm ${className}`}>
        No ratings yet
      </div>
    );
  }

  // Size-based classes
  const sizeClasses = {
    sm: 'text-sm gap-1',
    md: 'text-lg gap-1',
    lg: 'text-2xl gap-1.5',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // Calculate star rendering (rounded to 0.5 steps)
  const fullStars = Math.floor(stars);
  const hasHalfStar = (stars - fullStars) >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  // Format exact rating for tooltip (use original unrounded value)
  const formattedRating = rawStars != null ? formatRatingDisplay(rawStars) : '';

  return (
    <div
      className={`flex items-center ${sizeClasses[size]} ${className}`}
      title={`${formattedRating} stars${count !== undefined ? ` (${count} ratings)` : ''}`}
    >
      {/* Star display */}
      <div className="flex items-center gap-0.5">
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <BiSolidStar key={`full-${i}`} className="text-gray-400" />
        ))}

        {/* Half star */}
        {hasHalfStar && (
          <BiSolidStarHalf className="text-gray-400" />
        )}

        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <BiStar key={`empty-${i}`} className="text-gray-600" />
        ))}
      </div>

      {/* Mode-specific info */}
      {mode === 'average' && count !== undefined && count > 0 && (
        <span className={`${textSizeClasses[size]} text-text-tertiary ml-1.5`}>
          ({count})
        </span>
      )}

      {mode === 'personal' && (
        <span className={`${textSizeClasses[size]} text-primary ml-1 font-medium`}>
          (You)
        </span>
      )}
    </div>
  );
};

export default StarRating;
