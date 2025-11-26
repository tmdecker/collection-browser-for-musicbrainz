/**
 * @ai-file utility
 * @ai-description Shared string normalization for consistent genre/tag comparison
 * @ai-dependencies None (pure utility)
 * @ai-features
 * - Case-insensitive comparison with lowercase conversion
 * - Whitespace normalization (replace hyphens/underscores/multiple spaces with single space)
 * - Handles variations like "Hip Hop" vs "hip-hop" vs "Hip-Hop"
 */

/**
 * Normalizes strings for consistent comparison across genres and tags
 * Handles common variations like "Hip Hop" vs "hip-hop" vs "Hip-Hop"
 *
 * @param str - String to normalize
 * @returns Normalized lowercase string with standardized spacing
 */
export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[-_\s]+/g, ' ') // Replace hyphens, underscores, and multiple spaces with single space
    .replace(/\s+/g, ' '); // Ensure single spaces
};
