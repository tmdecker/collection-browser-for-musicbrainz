/**
 * @ai-file utility
 * @ai-description Rating utilities for extraction, formatting, and display logic
 * @ai-dependencies Rating, ReleaseGroup from @/types/music
 * @ai-features Rating extraction, formatting, display modes (average/personal), cache TTL checking
 */

import { Rating, ReleaseGroup } from '@/types/music';

export type RatingDisplayMode = 'average' | 'personal';

/**
 * Format star rating for display
 * @param stars - Star rating in 0-5 scale
 * @returns Formatted string (e.g., "4.2")
 */
export function formatRatingDisplay(stars: number): string {
  if (stars == null) return '0.0'; // Defensive: catches both null and undefined
  return stars.toFixed(1);
}

/**
 * Extract rating data from MusicBrainz API response
 * Note: API returns ratings in 0-5 scale, which we store directly without conversion
 * @param apiResponse - Raw API response object (rating.value is 0-5 scale)
 * @returns Rating object (0-5 scale) or undefined if no rating data
 */
export function extractRatingFromApiResponse(apiResponse: any): Rating | undefined {
  try {
    const hasRating = apiResponse.rating && typeof apiResponse.rating.value === 'number';
    const hasUserRating = apiResponse['user-rating'] && typeof apiResponse['user-rating'].value === 'number';

    // If neither rating exists, return undefined
    if (!hasRating && !hasUserRating) {
      return undefined;
    }

    const rating: Rating = {
      average: hasRating ? apiResponse.rating.value : null,
      count: hasRating ? (apiResponse.rating['votes-count'] || 0) : 0,
      personal: hasUserRating ? apiResponse['user-rating'].value : null,
      fetchedAt: Date.now(),
      requiresAuth: !hasUserRating, // If no user rating returned, auth might be required/missing
    };

    return rating;
  } catch (error) {
    console.warn('Failed to extract rating from API response:', error);
    return undefined;
  }
}

/**
 * Check if rating data needs to be refreshed based on TTL
 * @param rating - Rating object to check
 * @param maxAgeMs - Maximum age in milliseconds (default: 30 days)
 * @returns True if rating should be refreshed
 */
export function shouldRefreshRating(
  rating: Rating | undefined,
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000 // 30 days default
): boolean {
  if (!rating || !rating.fetchedAt) return true;
  return Date.now() - rating.fetchedAt > maxAgeMs;
}

/**
 * Get the rating to display based on display mode
 * @param album - ReleaseGroup with rating data
 * @param mode - Display mode (average or personal)
 * @returns Rating display data or null if no rating available
 */
export function getRatingDisplay(
  album: ReleaseGroup,
  mode: RatingDisplayMode
): {
  stars: number | null;
  count?: number;
  isPersonal: boolean;
} | null {
  if (!album.rating) return null;

  if (mode === 'personal') {
    // Try to show personal rating first
    if (album.rating.personal !== null) {
      const stars = album.rating.personal;
      return {
        stars,
        isPersonal: true,
      };
    }
    // No personal rating available
    return null;
  } else {
    // Average mode
    if (album.rating.average !== null) {
      const stars = album.rating.average;
      return {
        stars,
        count: album.rating.count,
        isPersonal: false,
      };
    }
    // No average rating available
    return null;
  }
}

/**
 * Check if an album has any rating data
 * @param album - ReleaseGroup to check
 * @returns True if album has rating data (average or personal)
 */
export function hasRatingData(album: ReleaseGroup): boolean {
  return !!(
    album.rating &&
    (album.rating.average !== null || album.rating.personal !== null)
  );
}
