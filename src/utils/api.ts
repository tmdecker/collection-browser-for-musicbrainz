/**
 * @ai-file utility
 * @ai-description MusicBrainz API client with OAuth-aware axios instance and release group fetching
 * @ai-dependencies axios, streaming-links, ratings utilities
 * @ai-features
 * - mbApi axios instance with auth cookies support
 * - fetchReleaseGroup with up to 100 releases
 * - AbortController support for request cancellation
 */

import axios from 'axios';
import { Collection, ReleaseGroup, CoverArt, Release, Media, Track } from '@/types/music';
import { fetchStreamingLinksForAlbum } from './streaming-links';
import { extractRatingFromApiResponse } from './ratings';


// MusicBrainz API base URL
const MB_API_BASE = '/api/musicbrainz';

// Create axios instance with appropriate headers
// Exported for use in other utilities that need to make MusicBrainz API calls
export const mbApi = axios.create({
  baseURL: MB_API_BASE,
  headers: {
    'Accept': 'application/json',
  },
  withCredentials: true, // Include cookies for OAuth authentication
});

// Cover Art Archive API base URL
const CA_API_BASE = '/api/coverart';


/**
 * Select the preferred release from a list of releases
 * @ai Priority: Official status first, then oldest release date
 * @ai Ensures album details (tracks, labels) come from original official release
 * @param releases - Array of releases from a release-group
 * @returns The preferred release, or null if no releases exist
 */
const selectPreferredRelease = (releases: Release[]): Release | null => {
  if (!releases || releases.length === 0) return null;

  // Priority 1: Official releases only (if available)
  const officialReleases = releases.filter(r => r.status === 'Official');
  const candidates = officialReleases.length > 0 ? officialReleases : releases;

  // Priority 2: Sort by date (oldest first = original release)
  const sorted = [...candidates].sort((a, b) => {
    const dateA = a.date || '9999-99-99';
    const dateB = b.date || '9999-99-99';
    return dateA.localeCompare(dateB);
  });

  return sorted[0];
};

/**
 * Fetch a specific release with detailed information including tracks and labels
 * @param signal - Optional AbortSignal to cancel the request
 */
const fetchReleaseWithDetails = async (releaseId: string, signal?: AbortSignal): Promise<Release> => {
  try {
    const response = await mbApi.get(`/release/${releaseId}`, {
      params: {
        fmt: 'json',
        inc: 'recordings+labels+artist-credits+url-rels',
      },
      signal,
    });

    return response.data as Release;
  } catch (error) {
    // Don't log AbortError
    if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
      throw error;
    }
    console.error(`❌ Error fetching release details ${releaseId}:`, error);
    throw error;
  }
};

/**
 * Convert MusicBrainz media tracks to our Track interface
 */
const extractTracksFromMedia = (media: Media[]): Track[] => {
  if (!media || media.length === 0) return [];

  const tracks: Track[] = [];

  media.forEach(medium => {
    if (medium.tracks) {
      tracks.push(...medium.tracks);
    }
  });

  return tracks;
};

/**
 * Fetch a specific release group with complete track and label information
 * @param signal - Optional AbortSignal to cancel the request
 */
export const fetchReleaseGroup = async (rgId: string, signal?: AbortSignal): Promise<ReleaseGroup> => {
  try {
    // Step 1: Fetch release group basic info (without releases, which are limited to 25)
    const rgResponse = await mbApi.get(`/release-group/${rgId}`, {
      params: {
        fmt: 'json',
        inc: 'artist-credits+genres+tags+ratings', // Include community ratings (user-ratings requires complex auth setup)
      },
      signal,
    });

    const releaseGroup = rgResponse.data as ReleaseGroup;

    // Extract and add rating data from API response
    try {
      const ratingData = extractRatingFromApiResponse(rgResponse.data);
      if (ratingData) {
        releaseGroup.rating = ratingData;
        console.log(`⭐ Extracted rating for ${rgId}: avg=${ratingData.average}, personal=${ratingData.personal}, count=${ratingData.count}`);
      }
    } catch (error) {
      console.warn(`Failed to extract rating for ${rgId}:`, error);
      // Don't fail the entire request if rating extraction fails
    }

    // Check if aborted before continuing
    if (signal?.aborted) {
      throw new Error('AbortError');
    }

    // Step 2: Fetch up to 100 releases using browse endpoint
    // Wait 1 second to respect MusicBrainz rate limits (1 req/sec)
    await new Promise(resolve => setTimeout(resolve, 1000));

    const releasesResponse = await mbApi.get('/release', {
      params: {
        fmt: 'json',
        'release-group': rgId,
        inc: 'media', // Include media info to detect Digital Media format
        limit: 100, // API max for browse requests
      },
      signal,
    });

    const releases = releasesResponse.data.releases || [];
    console.log(`📊 Fetched ${releases.length} releases for release group ${rgId} via browse endpoint`);

    // Add releases to release group
    releaseGroup.releases = releases;

    // Warn if we hit the 100-release limit (indicates potential incomplete data)
    if (releases.length === 100) {
      console.warn(`⚠️ Release group ${rgId} has 100 releases (API limit) - Digital Media releases may be missing`);
    }

    // Step 3: Select the preferred release
    const preferredRelease = selectPreferredRelease(releaseGroup.releases || []);

    if (!preferredRelease) {
      console.warn(`❌ No releases found for release group ${rgId}`);
      return {
        ...releaseGroup,
        cover: `/api/coverart/release-group/${rgId}/front` // Ensure cover URL is included
      };
    }

    // Check if aborted before fetching release details
    if (signal?.aborted) {
      throw new Error('AbortError');
    }

    // Step 4: Fetch detailed release information with tracks and labels
    try {
      console.log(`📀 Fetching release details with tracks for ${preferredRelease.id}...`);
      const detailedRelease = await fetchReleaseWithDetails(preferredRelease.id, signal);
      console.log(`✅ Release details fetched, extracting ${detailedRelease.media?.length || 0} media items`);

      // Step 5: Extract tracks from media
      const tracklist = extractTracksFromMedia(detailedRelease.media || []);
      console.log(`✅ Extracted ${tracklist?.length || 0} tracks, returning data immediately`);

      // Step 6: Return data immediately WITHOUT streaming links (don't block tracklist display)
      // Streaming links will be fetched separately by the UI component
      return {
        ...releaseGroup,
        cover: `/api/coverart/release-group/${rgId}/front`, // Ensure cover URL is included
        tracklist,
        releaseDetails: detailedRelease,
        selectedReleaseId: preferredRelease.id,
        streamingLinks: undefined // UI will fetch this separately
      };
    } catch (releaseError) {
      // Don't log AbortError
      if (axios.isAxiosError(releaseError) && releaseError.code === 'ERR_CANCELED') {
        throw releaseError;
      }
      console.warn(`❌ Failed to fetch release details for ${preferredRelease.id}:`, releaseError);
      return {
        ...releaseGroup,
        cover: `/api/coverart/release-group/${rgId}/front` // Ensure cover URL is included even in fallback
      };
    }
  } catch (error) {
    // Don't log AbortError - it's expected when user switches albums
    if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
      throw error;
    }
    console.error(`❌ Error fetching release group ${rgId}:`, error);
    throw error;
  }
};

/**
 * Fetch cover art for a release group
 */
export const fetchCoverArt = async (rgId: string): Promise<string | null> => {
  try {
    const url = `${CA_API_BASE}/release-group/${rgId}/front-500`;
    const response = await axios.get(url);
    return response.config.url || null;
  } catch (error) {
    console.warn(`❌ No cover art for ${rgId}`);
    return null;
  }
};

/**
 * Fetch detailed cover art information
 */
export const fetchCoverArtInfo = async (rgId: string): Promise<CoverArt | null> => {
  try {
    const response = await axios.get(`${CA_API_BASE}/release-group/${rgId}`);
    return response.data as CoverArt;
  } catch (error) {
    console.warn(`❌ No cover art info for ${rgId}`);
    return null;
  }
};

/**
 * Fetch a specific release with URL relationships for streaming links
 * @param signal - Optional AbortSignal to cancel the request
 */
export const fetchReleaseUrlRels = async (releaseId: string, signal?: AbortSignal): Promise<Release> => {
  try {
    const response = await mbApi.get(`/release/${releaseId}`, {
      params: {
        fmt: 'json',
        inc: 'url-rels',
      },
      signal,
    });

    return response.data as Release;
  } catch (error) {
    // Don't log AbortError - it's expected when user switches albums
    if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
      throw error;
    }
    console.error(`Error fetching release URL relationships ${releaseId}:`, error);
    throw error;
  }
};

