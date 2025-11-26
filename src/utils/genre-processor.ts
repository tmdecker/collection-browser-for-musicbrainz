/**
 * @ai-file utility
 * @ai-description Official genre extraction, counting, and filtering from MusicBrainz album collections
 * @ai-dependencies ReleaseGroup from @/types/music, normalizeString from string-normalization
 * @ai-features
 * - Extract and count genres from album.genres or album.tags (configurable via useGenresOnly)
 * - Normalize genre names for consistent filtering
 * - Filter albums by selected genres with OR logic
 * - Search genres by substring matching
 */

import { ReleaseGroup } from '@/types/music';
import { normalizeString } from './string-normalization';

export interface GenreStat {
  name: string;
  count: number;
  normalizedName: string;
}

/**
 * Helper function to extract genre name from either string or object format
 */
const getGenreName = (item: any): string | null => {
  if (typeof item === 'string') {
    return item;
  }
  if (item && typeof item === 'object' && item.name) {
    return item.name;
  }
  return null;
};

/**
 * Normalizes genre names for consistent comparison
 * Handles common variations like "Hip Hop" vs "hip-hop" vs "Hip-Hop"
 */
export const normalizeGenreName = normalizeString;

/**
 * Extracts genre statistics from a collection of albums
 * Returns genres sorted by occurrence count (most common first)
 * @param albums Array of release groups to process
 * @param useGenresOnly If true, use only official genres (album.genres); if false, use all tags (album.tags).
 *                      Default: true. For filter panel, always use true (official genres only).
 *                      For album details panel display, use the user's preference setting.
 */
export const extractGenreStats = (albums: ReleaseGroup[], useGenresOnly: boolean = true): GenreStat[] => {
  const genreCountMap = new Map<string, { name: string; count: number }>();

  // Process all albums and count genre occurrences
  albums.forEach(album => {
    // Choose which field to use based on preference
    const sourceArray = useGenresOnly ? album.genres : album.tags;

    if (sourceArray && Array.isArray(sourceArray)) {
      sourceArray.forEach(item => {
        const genreName = getGenreName(item);
        if (genreName) {
          const normalizedName = normalizeGenreName(genreName);

          if (genreCountMap.has(normalizedName)) {
            const existing = genreCountMap.get(normalizedName)!;
            existing.count++;
          } else {
            genreCountMap.set(normalizedName, {
              name: genreName, // Keep original case for display
              count: 1
            });
          }
        }
      });
    }
  });

  // Convert to array and sort by count (descending)
  const genreStats = Array.from(genreCountMap.entries()).map(([normalizedName, data]) => ({
    name: data.name,
    count: data.count,
    normalizedName
  }));

  // Sort by count (most common first), then alphabetically
  genreStats.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.name.localeCompare(b.name);
  });

  return genreStats;
};

/**
 * Filters genre statistics by search query
 */
export const filterGenresBySearch = (genreStats: GenreStat[], searchQuery: string): GenreStat[] => {
  if (!searchQuery.trim()) {
    return genreStats;
  }

  const normalizedQuery = normalizeGenreName(searchQuery);

  return genreStats.filter(genre =>
    genre.normalizedName.includes(normalizedQuery) ||
    genre.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
};

/**
 * Checks if an album matches any of the selected genre filters
 * Returns true if the album has at least one genre/tag that matches the filters
 * Always checks against album.genres (official genres) for filter panel usage
 * @param album The album to check
 * @param selectedGenres Array of selected genre names
 * @param useGenresOnly If true, use only official genres (album.genres); if false, use all tags (album.tags).
 *                      Default: true. For filter matching, always use true (official genres only).
 */
export const albumMatchesGenreFilters = (album: ReleaseGroup, selectedGenres: string[], useGenresOnly: boolean = true): boolean => {
  // If no filters are selected, show all albums
  if (selectedGenres.length === 0) {
    return true;
  }

  // Choose which field to use based on preference
  const sourceArray = useGenresOnly ? album.genres : album.tags;

  // If album has no genres/tags, it doesn't match any genre filter
  if (!sourceArray || !Array.isArray(sourceArray) || sourceArray.length === 0) {
    return false;
  }

  // Normalize selected genres for comparison
  const normalizedSelectedGenres = selectedGenres.map(normalizeGenreName);

  // Check if any of the album's genres/tags match the selected genres
  return sourceArray.some(item => {
    const genreName = getGenreName(item);
    if (genreName) {
      const normalizedItem = normalizeGenreName(genreName);
      return normalizedSelectedGenres.includes(normalizedItem);
    }
    return false;
  });
};

/**
 * Gets the top N most common genres from the collection
 * @param albums Array of release groups to process
 * @param limit Maximum number of genres to return (default: 20)
 * @param useGenresOnly If true, use only official genres (album.genres); if false, use all tags (album.tags).
 *                      Default: true. For filter panel, always use true.
 */
export const getTopGenres = (albums: ReleaseGroup[], limit: number = 20, useGenresOnly: boolean = true): GenreStat[] => {
  const allGenres = extractGenreStats(albums, useGenresOnly);
  return allGenres.slice(0, limit);
};

/**
 * Gets all unique genres from the collection without counting
 * Useful for simpler operations where counts aren't needed
 * @param albums Array of release groups to process
 * @param useGenresOnly If true, use only official genres (album.genres); if false, use all tags (album.tags).
 *                      Default: true. For filter panel, always use true.
 */
export const extractUniqueGenres = (albums: ReleaseGroup[], useGenresOnly: boolean = true): string[] => {
  const genreSet = new Set<string>();

  albums.forEach(album => {
    // Choose which field to use based on preference
    const sourceArray = useGenresOnly ? album.genres : album.tags;

    if (sourceArray && Array.isArray(sourceArray)) {
      sourceArray.forEach(item => {
        const genreName = getGenreName(item);
        if (genreName) {
          genreSet.add(genreName);
        }
      });
    }
  });

  return Array.from(genreSet).sort();
};