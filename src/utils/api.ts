/**
 * @ai-file utility
 * @ai-description Client for the /api/musicbrainz proxy (OAuth cookies included)
 * @ai-dependencies axios
 * @ai-features
 * - mbApi axios instance with auth cookies support
 * - fetchReleaseUrlRels for streaming URL discovery
 * - AbortController support for request cancellation
 */

import axios from 'axios';
import { Release } from '@/types/music';

// MusicBrainz API base URL (server-side proxy with rate limiting)
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
    // Warning, not error: callers fall back to other releases, and console.error opens the Next dev overlay
    console.warn(`Error fetching release URL relationships ${releaseId}:`, error);
    throw error;
  }
};

