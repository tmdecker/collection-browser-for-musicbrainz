/**
 * @ai-file utility
 * @ai-description Release date extraction and year range filtering
 * @ai-dependencies ReleaseGroup from @/types/music
 * @ai-features
 * - Extract year from first_release_date field (handles YYYY, YYYY-MM, YYYY-MM-DD formats)
 * - Calculate min/max year range across collection
 * - Filter albums by year range
 */

import { ReleaseGroup } from '@/types/music';

export interface YearRange {
  min: number;
  max: number;
}

/**
 * Extracts year from first_release_date string (format: YYYY-MM-DD, YYYY-MM, or YYYY)
 * Returns null if date is missing or invalid
 */
export const extractYear = (dateString: string | undefined): number | null => {
  if (!dateString) {
    return null;
  }

  // Extract year from various date formats
  const yearMatch = dateString.match(/^(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    // Validate reasonable year range (1900-2100)
    if (year >= 1900 && year <= 2100) {
      return year;
    }
  }

  return null;
};

/**
 * Calculates the available year range from a collection of albums
 * Returns { min, max } or null if no valid dates found
 */
export const getAvailableYearRange = (albums: ReleaseGroup[]): YearRange | null => {
  let minYear = Infinity;
  let maxYear = -Infinity;
  let hasValidDate = false;

  albums.forEach(album => {
    const year = extractYear(album.first_release_date);
    if (year !== null) {
      hasValidDate = true;
      minYear = Math.min(minYear, year);
      maxYear = Math.max(maxYear, year);
    }
  });

  if (!hasValidDate) {
    return null;
  }

  return { min: minYear, max: maxYear };
};

/**
 * Checks if an album matches the specified year range filter
 * Albums without valid dates are excluded from results
 * @param album Album to check
 * @param minYear Minimum year (inclusive)
 * @param maxYear Maximum year (inclusive)
 * @returns true if album's release year is within range
 */
export const albumMatchesDateFilter = (
  album: ReleaseGroup,
  minYear: number,
  maxYear: number
): boolean => {
  const year = extractYear(album.first_release_date);

  // Exclude albums without valid dates
  if (year === null) {
    return false;
  }

  // Check if year is within range (inclusive)
  return year >= minYear && year <= maxYear;
};
