/**
 * @ai-file utility
 * @ai-description Validates and extracts MusicBrainz IDs from URLs and strings
 * @ai-dependencies None (pure utility functions)
 * @ai-features
 * - MBID format validation (8-4-4-4-12 hexadecimal pattern)
 * - URL extraction for collection URLs
 * - Collection validation with API verification
 */

/**
 * Utilities for validating and extracting MusicBrainz IDs (MBIDs)
 */

// MBID format: 8-4-4-4-12 hexadecimal characters
const MBID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract MBID from a MusicBrainz collection URL
 * Supports formats:
 * - https://musicbrainz.org/collection/27a3c068-3ec5-421a-ad12-599d085fdeb1
 * - http://musicbrainz.org/collection/27a3c068-3ec5-421a-ad12-599d085fdeb1
 * - musicbrainz.org/collection/27a3c068-3ec5-421a-ad12-599d085fdeb1
 */
export function extractMbidFromUrl(input: string): string | null {
  const trimmed = input.trim();

  // Pattern to match MusicBrainz collection URLs
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?musicbrainz\.org\/collection\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

  const match = trimmed.match(urlPattern);
  return match ? match[1] : null;
}

/**
 * Check if a string is a valid MBID format
 */
export function isValidMbidFormat(mbid: string): boolean {
  return MBID_REGEX.test(mbid.trim());
}

/**
 * Validate if a MusicBrainz collection ID exists and is a release-group collection
 * Returns validation result with status and message
 */
export async function validateCollectionId(input: string): Promise<{
  valid: boolean;
  mbid: string | null;
  message: string;
}> {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      valid: false,
      mbid: null,
      message: 'Please enter a collection ID or URL',
    };
  }

  // Try to extract MBID from URL first
  let mbid = extractMbidFromUrl(trimmed);

  // If not a URL, check if it's a direct MBID
  if (!mbid) {
    if (isValidMbidFormat(trimmed)) {
      mbid = trimmed;
    } else {
      return {
        valid: false,
        mbid: null,
        message: 'Invalid format. Enter a valid MBID or MusicBrainz collection URL',
      };
    }
  }

  // Validate the collection exists and is a release-group collection
  try {
    const response = await fetch(`/api/musicbrainz/collection/${mbid}?fmt=json&inc=release-groups`);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          valid: false,
          mbid,
          message: 'Collection not found. Make sure the collection is public or log in to access private collections.',
        };
      }
      if (response.status === 401) {
        return {
          valid: false,
          mbid,
          message: 'This collection is private. Please log in with MusicBrainz to access it.',
        };
      }
      return {
        valid: false,
        mbid,
        message: `API error: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Check if it's a release-group collection (API returns 'release_group' with underscore)
    if (data['entity-type'] !== 'release_group') {
      return {
        valid: false,
        mbid,
        message: `This is a ${data['entity-type']} collection. Please use a release-group collection.`,
      };
    }

    return {
      valid: true,
      mbid,
      message: `Valid release-group collection with ${data['release-group-count'] || 0} items`,
    };
  } catch (error) {
    console.error('Collection validation error:', error);
    return {
      valid: false,
      mbid,
      message: 'Failed to validate collection. Please try again.',
    };
  }
}
