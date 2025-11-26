/**
 * @ai-file utility
 * @ai-description MusicBrainz API response normalization for consistent property naming
 * @ai-dependencies ReleaseGroup from @/types/music, extractRatingFromApiResponse
 * @ai-features
 * - Normalize hyphenated to camelCase properties (first-release-date → first_release_date)
 * - Provide default values for missing properties
 * - Extract and normalize ratings
 */

import { ReleaseGroup } from '@/types/music';
import { extractRatingFromApiResponse } from './ratings';

/**
 * MusicBrainz API response formats can be inconsistent, especially between
 * different endpoints. This utility normalizes the data to ensure consistent
 * property names and structure across the application.
 */
export const normalizeReleaseGroup = (releaseGroup: any): ReleaseGroup => {
  // Clone the object to avoid mutating the original
  const normalized = { ...releaseGroup };
  
  // Handle artist credits which can come in various formats
  normalized.artist_credit = normalized.artist_credit || 
                             normalized['artist-credit'] || 
                             [];
  
  // Handle release date variations
  normalized.first_release_date = normalized.first_release_date || 
                                  normalized['first-release-date'] || 
                                  '';
  
  // Handle primary type variations
  normalized.primary_type = normalized.primary_type || 
                            normalized['primary-type'] || 
                            normalized.type || 
                            '';
  
  // Handle secondary types
  normalized.secondary_types = normalized.secondary_types || 
                               normalized['secondary-types'] || 
                               [];
  
  // Default releases to empty array if not present
  normalized.releases = normalized.releases || [];
  
  // Default cover to placeholder if not present, but preserve valid cover URLs
  if (!normalized.cover || normalized.cover === '/placeholder.svg') {
    normalized.cover = '/placeholder.svg';
  }
  // Preserve existing cover URLs that start with /api/coverart/
  
  // Ensure title exists
  normalized.title = normalized.title || 'Unknown Title';
  
  // Ensure disambiguation exists
  normalized.disambiguation = normalized.disambiguation || '';

  // Preserve important fields if present (needed for filtering and details)
  if (releaseGroup.releaseDetails || normalized.releaseDetails) {
    normalized.releaseDetails = releaseGroup.releaseDetails || normalized.releaseDetails;
  }

  // Preserve tracklist if present
  if (releaseGroup.tracklist || normalized.tracklist) {
    normalized.tracklist = releaseGroup.tracklist || normalized.tracklist;
  }

  // Preserve streamingLinks if present
  if (releaseGroup.streamingLinks || normalized.streamingLinks) {
    normalized.streamingLinks = releaseGroup.streamingLinks || normalized.streamingLinks;
  }

  // Preserve selectedReleaseId if present
  if (releaseGroup.selectedReleaseId || normalized.selectedReleaseId) {
    normalized.selectedReleaseId = releaseGroup.selectedReleaseId || normalized.selectedReleaseId;
  }

  // Handle genres - MusicBrainz returns genres as array of objects with name and count
  // We'll preserve the full objects to enable sorting by popularity
  if (normalized.genres && Array.isArray(normalized.genres)) {
    normalized.genres = normalized.genres.map((genre: any) => {
      // If genre is already a string, keep it for backward compatibility
      if (typeof genre === 'string') return genre;
      // If genre is an object with name and count, preserve both
      if (genre.name) {
        return {
          name: genre.name,
          count: genre.count || 0
        };
      }
      return genre;
    }).filter(Boolean);
  } else {
    normalized.genres = [];
  }

  // Handle tags - MusicBrainz returns tags as array of objects with name and count
  // We'll preserve the full objects to enable sorting by popularity
  if (normalized.tags && Array.isArray(normalized.tags)) {
    normalized.tags = normalized.tags.map((tag: any) => {
      // If tag is already a string, keep it for backward compatibility
      if (typeof tag === 'string') return tag;
      // If tag is an object with name and count, preserve both
      if (tag.name) {
        return {
          name: tag.name,
          count: tag.count || 0
        };
      }
      return tag;
    }).filter(Boolean);
  } else {
    normalized.tags = [];
  }

  // Extract and preserve rating data if present
  if (releaseGroup.rating || releaseGroup['user-rating']) {
    try {
      const ratingData = extractRatingFromApiResponse(releaseGroup);
      if (ratingData) {
        normalized.rating = ratingData;
      }
    } catch (error) {
      console.warn('Failed to extract rating during normalization:', error);
      // Don't fail normalization if rating extraction fails
    }
  } else if (normalized.rating) {
    // Preserve existing rating data (from cache or previous fetch)
    normalized.rating = normalized.rating;
  }

  return normalized as ReleaseGroup;
};

/**
 * Normalize an array of release groups
 */
export const normalizeReleaseGroups = (releaseGroups: any[]): ReleaseGroup[] => {
  console.log(`🟡 normalize-mb-data: Normalizing ${releaseGroups.length} release groups`);
  
  if (!Array.isArray(releaseGroups)) {
    console.error('normalizeReleaseGroups received non-array:', releaseGroups);
    return [];
  }
  
  const normalized = releaseGroups.map(normalizeReleaseGroup);
  console.log(`🟡 normalize-mb-data: Normalized ${normalized.length} release groups`);
  return normalized;
};
