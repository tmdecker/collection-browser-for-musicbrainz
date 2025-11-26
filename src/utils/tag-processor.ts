/**
 * @ai-file utility
 * @ai-description Non-official tag extraction and filtering (album.tags excluding album.genres)
 * @ai-dependencies ReleaseGroup from @/types/music, normalizeString from string-normalization
 * @ai-features
 * - Extract and count tags from album.tags, excluding official genres from album.genres
 * - Normalize tag names for consistent filtering
 * - Filter albums by selected tags with OR logic
 * - Search tags by substring matching
 */

import { ReleaseGroup } from '@/types/music';
import { normalizeString } from './string-normalization';

export interface TagStat {
  name: string;
  count: number;
  normalizedName: string;
}

/**
 * Helper function to extract tag name from either string or object format
 */
const getTagName = (item: any): string | null => {
  if (typeof item === 'string') {
    return item;
  }
  if (item && typeof item === 'object' && item.name) {
    return item.name;
  }
  return null;
};

/**
 * Normalizes tag names for consistent comparison
 * Handles common variations like "Hip Hop" vs "hip-hop" vs "Hip-Hop"
 */
export const normalizeTagName = normalizeString;

/**
 * Extracts tag statistics from a collection of albums
 * Returns tags sorted by occurrence count (most common first)
 * Uses album.tags field but excludes official genres from album.genres
 * This prevents duplication between Genres and Tags filter categories
 * @param albums Array of release groups to process
 */
export const extractTagStats = (albums: ReleaseGroup[]): TagStat[] => {
  const tagCountMap = new Map<string, { name: string; count: number }>();

  // Process all albums and count tag occurrences
  albums.forEach(album => {
    // Build set of this album's official genre names (normalized)
    const albumGenres = new Set<string>();
    if (album.genres && Array.isArray(album.genres)) {
      album.genres.forEach(item => {
        const genreName = getTagName(item);
        if (genreName) {
          albumGenres.add(normalizeTagName(genreName));
        }
      });
    }

    // Process tags from album.tags, excluding official genres
    const sourceArray = album.tags;

    if (sourceArray && Array.isArray(sourceArray)) {
      sourceArray.forEach(item => {
        const tagName = getTagName(item);
        if (tagName) {
          const normalizedName = normalizeTagName(tagName);

          // Skip if this tag is an official genre for this album
          if (albumGenres.has(normalizedName)) {
            return; // Continue to next tag
          }

          if (tagCountMap.has(normalizedName)) {
            const existing = tagCountMap.get(normalizedName)!;
            existing.count++;
          } else {
            tagCountMap.set(normalizedName, {
              name: tagName, // Keep original case for display
              count: 1
            });
          }
        }
      });
    }
  });

  // Convert to array and sort by count (descending)
  const tagStats = Array.from(tagCountMap.entries()).map(([normalizedName, data]) => ({
    name: data.name,
    count: data.count,
    normalizedName
  }));

  // Sort by count (most common first), then alphabetically
  tagStats.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.name.localeCompare(b.name);
  });

  return tagStats;
};

/**
 * Filters tag statistics by search query
 */
export const filterTagsBySearch = (tagStats: TagStat[], searchQuery: string): TagStat[] => {
  if (!searchQuery.trim()) {
    return tagStats;
  }

  const normalizedQuery = normalizeTagName(searchQuery);

  return tagStats.filter(tag =>
    tag.normalizedName.includes(normalizedQuery) ||
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
};

/**
 * Checks if an album matches any of the selected tag filters
 * Returns true if the album has at least one tag that matches the filters
 * Excludes official genres to prevent duplication with genre filters
 * @param album The album to check
 * @param selectedTags Array of selected tag names
 */
export const albumMatchesTagFilters = (album: ReleaseGroup, selectedTags: string[]): boolean => {
  // If no filters are selected, show all albums
  if (selectedTags.length === 0) {
    return true;
  }

  // Build set of this album's official genres (normalized)
  const albumGenres = new Set<string>();
  if (album.genres && Array.isArray(album.genres)) {
    album.genres.forEach(item => {
      const genreName = getTagName(item);
      if (genreName) {
        albumGenres.add(normalizeTagName(genreName));
      }
    });
  }

  // Use tags field
  const sourceArray = album.tags;

  // If album has no tags, it doesn't match any tag filter
  if (!sourceArray || !Array.isArray(sourceArray) || sourceArray.length === 0) {
    return false;
  }

  // Normalize selected tags for comparison
  const normalizedSelectedTags = selectedTags.map(normalizeTagName);

  // Check if any NON-GENRE tags match the selected tags
  return sourceArray.some(item => {
    const tagName = getTagName(item);
    if (tagName) {
      const normalizedItem = normalizeTagName(tagName);

      // Skip if this is an official genre
      if (albumGenres.has(normalizedItem)) {
        return false;
      }

      return normalizedSelectedTags.includes(normalizedItem);
    }
    return false;
  });
};

/**
 * Gets the top N most common tags from the collection
 * @param albums Array of release groups to process
 * @param limit Maximum number of tags to return (default: 20)
 */
export const getTopTags = (albums: ReleaseGroup[], limit: number = 20): TagStat[] => {
  const allTags = extractTagStats(albums);
  return allTags.slice(0, limit);
};

/**
 * Gets all unique tags from the collection without counting
 * Useful for simpler operations where counts aren't needed
 * @param albums Array of release groups to process
 */
export const extractUniqueTags = (albums: ReleaseGroup[]): string[] => {
  const tagSet = new Set<string>();

  albums.forEach(album => {
    // Use tags field
    const sourceArray = album.tags;

    if (sourceArray && Array.isArray(sourceArray)) {
      sourceArray.forEach(item => {
        const tagName = getTagName(item);
        if (tagName) {
          tagSet.add(tagName);
        }
      });
    }
  });

  return Array.from(tagSet).sort();
};
