/**
 * @ai-file utility
 * @ai-description Validates and extracts MusicBrainz IDs from URLs and strings
 * @ai-dependencies None (pure utility functions)
 * @ai-features
 * - MBID format validation (8-4-4-4-12 hexadecimal pattern)
 * - URL extraction for collection and series URLs
 * - Collection and series validation with API verification
 */

/**
 * Utilities for validating and extracting MusicBrainz IDs (MBIDs)
 */

// MBID format: 8-4-4-4-12 hexadecimal characters
const MBID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EntityType = 'collection' | 'series';

export interface ExtractedEntity {
  mbid: string;
  entityType: EntityType;
}

/**
 * Extract MBID and entity type from a MusicBrainz collection or series URL
 * Supports formats:
 * - https://musicbrainz.org/collection/27a3c068-3ec5-421a-ad12-599d085fdeb1
 * - https://musicbrainz.org/series/27a3c068-3ec5-421a-ad12-599d085fdeb1
 * - http://musicbrainz.org/collection/... or http://musicbrainz.org/series/...
 * - musicbrainz.org/collection/... or musicbrainz.org/series/...
 */
export function extractMbidFromUrl(input: string): ExtractedEntity | null {
  const trimmed = input.trim();

  // Pattern to match MusicBrainz collection URLs
  const collectionPattern = /(?:https?:\/\/)?(?:www\.)?musicbrainz\.org\/collection\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

  // Pattern to match MusicBrainz series URLs
  const seriesPattern = /(?:https?:\/\/)?(?:www\.)?musicbrainz\.org\/series\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

  const collectionMatch = trimmed.match(collectionPattern);
  if (collectionMatch) {
    return { mbid: collectionMatch[1], entityType: 'collection' };
  }

  const seriesMatch = trimmed.match(seriesPattern);
  if (seriesMatch) {
    return { mbid: seriesMatch[1], entityType: 'series' };
  }

  return null;
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
  const extracted = extractMbidFromUrl(trimmed);
  let mbid: string | null = null;

  // If not a URL, check if it's a direct MBID
  if (!extracted) {
    if (isValidMbidFormat(trimmed)) {
      mbid = trimmed;
    } else {
      return {
        valid: false,
        mbid: null,
        message: 'Invalid format. Enter a valid MBID or MusicBrainz collection URL',
      };
    }
  } else {
    mbid = extracted.mbid;
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

/**
 * Validate if a MusicBrainz series ID exists and contains release-groups
 * Returns validation result with status and message
 */
export async function validateSeriesId(input: string): Promise<{
  valid: boolean;
  mbid: string | null;
  message: string;
}> {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      valid: false,
      mbid: null,
      message: 'Please enter a series ID or URL',
    };
  }

  // Try to extract MBID from URL first
  const extracted = extractMbidFromUrl(trimmed);
  let mbid: string | null = null;

  // If not a URL, check if it's a direct MBID
  if (!extracted) {
    if (isValidMbidFormat(trimmed)) {
      mbid = trimmed;
    } else {
      return {
        valid: false,
        mbid: null,
        message: 'Invalid format. Enter a valid MBID or MusicBrainz series URL',
      };
    }
  } else {
    mbid = extracted.mbid;
  }

  // Validate the series exists
  try {
    const response = await fetch(`/api/musicbrainz/series/${mbid}?fmt=json&inc=release-group-rels`);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          valid: false,
          mbid,
          message: 'Series not found. Please check the series ID or URL.',
        };
      }
      if (response.status === 401) {
        return {
          valid: false,
          mbid,
          message: 'This series is private. Please log in with MusicBrainz to access it.',
        };
      }
      return {
        valid: false,
        mbid,
        message: `API error: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Check if the series has release-group relationships
    const hasReleaseGroups = data.relations?.some((rel: any) => rel.type === 'part of' && rel['target-type'] === 'release_group');

    if (!hasReleaseGroups) {
      return {
        valid: false,
        mbid,
        message: 'This series does not contain any release groups.',
      };
    }

    return {
      valid: true,
      mbid,
      message: `Valid series: ${data.name || 'Unknown'}`,
    };
  } catch (error) {
    console.error('Series validation error:', error);
    return {
      valid: false,
      mbid,
      message: 'Failed to validate series. Please try again.',
    };
  }
}

/**
 * Unified validation function that auto-detects entity type (collection or series)
 * Returns validation result with status, message, and entity type
 */
export async function validateEntityId(input: string): Promise<{
  valid: boolean;
  mbid: string | null;
  entityType: EntityType | null;
  message: string;
}> {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      valid: false,
      mbid: null,
      entityType: null,
      message: 'Please enter a collection or series ID or URL',
    };
  }

  // Try to extract MBID and entity type from URL
  const extracted = extractMbidFromUrl(trimmed);

  if (extracted) {
    // URL was provided - validate based on detected entity type
    if (extracted.entityType === 'collection') {
      const result = await validateCollectionId(trimmed);
      return {
        ...result,
        entityType: 'collection',
      };
    } else {
      const result = await validateSeriesId(trimmed);
      return {
        ...result,
        entityType: 'series',
      };
    }
  }

  // No URL - check if it's a direct MBID
  if (!isValidMbidFormat(trimmed)) {
    return {
      valid: false,
      mbid: null,
      entityType: null,
      message: 'Invalid format. Enter a valid MBID or MusicBrainz collection/series URL',
    };
  }

  // Direct MBID provided - try collection first, then series
  const collectionResult = await validateCollectionId(trimmed);
  if (collectionResult.valid) {
    return {
      ...collectionResult,
      entityType: 'collection',
    };
  }

  const seriesResult = await validateSeriesId(trimmed);
  if (seriesResult.valid) {
    return {
      ...seriesResult,
      entityType: 'series',
    };
  }

  // Neither worked
  return {
    valid: false,
    mbid: trimmed,
    entityType: null,
    message: 'Not a valid collection or series ID',
  };
}
