/**
 * @ai-file utility
 * @ai-description Fetches MusicBrainz collections with pagination and rate limiting
 * @ai-dependencies mbApi from api.ts, normalizeReleaseGroups from normalize-mb-data
 * @ai-features
 * - Paginated collection fetching with 100-item limit per page
 * - 2-second rate limiting between requests (MusicBrainz requirement)
 * - Collection name extraction with early callback support
 */

import { ReleaseGroup } from '@/types/music';
import { normalizeReleaseGroups } from './normalize-mb-data';
import { mbApi } from './api';

/**
 * Fetch all release groups in a MusicBrainz collection using pagination
 * with proper rate limiting according to MusicBrainz guidelines
 *
 * @param collectionId - MusicBrainz collection ID
 * @param userAgent - User agent string for API requests (deprecated - handled by API proxy)
 * @param onCollectionNameFetched - Optional callback called immediately when collection name is fetched
 * @returns Object containing release groups array and collection name
 */
export const fetchAllReleaseGroupsInCollection = async (
  collectionId: string,
  userAgent: string = 'MusicLibraryViewer/1.0.0 (mailto:your.email@example.com)',
  onCollectionNameFetched?: (name: string) => void
): Promise<{ releaseGroups: ReleaseGroup[], collectionName: string }> => {
  // Key parameters
  const limit = 100;
  const allReleaseGroups = [];

  try {
    // Get the collection info to see the expected count and name
    const collectionResponse = await mbApi.get(
      `/collection/${collectionId}`,
      {
        params: { fmt: 'json' },
      }
    );

    const collectionData = collectionResponse.data;
    const expectedTotal = collectionData['release-group-count'] || 0;
    const collectionName = collectionData.name || '';
    console.log(`Collection "${collectionName}" reports having ${expectedTotal} total release groups`);

    // Call the callback immediately with the collection name (before fetching all release groups)
    if (onCollectionNameFetched && collectionName) {
      onCollectionNameFetched(collectionName);
      console.log(`✨ Triggered early collection name callback: "${collectionName}"`);
    }

    // Calculate how many pages we need to fetch
    const pagesNeeded = Math.ceil(expectedTotal / limit);
    console.log(`Will fetch ${pagesNeeded} pages with ${limit} items per page`);
    
    // We'll use a more robust approach with multiple retries and respecting rate limits
    for (let page = 0; page < pagesNeeded; page++) {
      const offset = page * limit;
      console.log(`Fetching page ${page + 1}/${pagesNeeded} at offset ${offset}`);
      
      // This is critical - MusicBrainz requires a 1 second delay between requests
      // We'll use 2 seconds to be extra safe
      if (page > 0) {
        console.log(`Waiting 2 seconds before next request to respect rate limits...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // We'll retry up to 5 times with exponential backoff
      let retryCount = 0;
      const maxRetries = 5;
      let success = false;
      let retryDelay = 1000; // Start with 1 second
      
      while (retryCount < maxRetries && !success) {
        try {
          const response = await mbApi.get(
            '/release-group',
            {
              params: {
                fmt: 'json',
                collection: collectionId,
                inc: 'artist-credits+genres+tags+ratings',
                limit,
                offset,
              },
              timeout: 30000 // 30 second timeout
            }
          );
          
          const releaseGroups = response.data['release-groups'] || [];
          console.log(`Page ${page + 1}: Got ${releaseGroups.length} items at offset ${offset}`);
          
          // Add to our array
          allReleaseGroups.push(...releaseGroups);
          success = true;
          
          // Stop if we get an empty page
          if (releaseGroups.length === 0) {
            console.log(`Page ${page + 1}: Got 0 items, done fetching`);
            break;
          }
        } catch (error: any) {
          retryCount++;

          // Check if this is a rate limit error (503)
          const isRateLimit = error.response && error.response.status === 503;

          // Get retry-after header if available
          let retryAfter = 0;
          if (isRateLimit && error.response.headers['retry-after']) {
            retryAfter = parseInt(error.response.headers['retry-after'], 10) * 1000;
          }
          
          // Use exponential backoff: 1s, 2s, 4s, 8s, 16s
          // Or use the retry-after header value if provided
          const backoffDelay = retryAfter || retryDelay * Math.pow(2, retryCount - 1);
          
          console.log(`Rate limit hit on page ${page + 1}, attempt ${retryCount}. Waiting ${backoffDelay/1000}s before retry...`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          
          // If we're at the last retry, log an error but continue to the next page
          if (retryCount === maxRetries) {
            console.error(`Failed to fetch page ${page + 1} after ${maxRetries} attempts.`);
          }
        }
      }
      
      // If we've failed this page after max retries but have some data, continue
      if (!success && allReleaseGroups.length > 0) {
        console.warn(`Skipping page ${page + 1} after ${maxRetries} failed attempts. Continuing to next page.`);
      }
    }
    
    // Get unique items (in case of duplicates)
    const uniqueIds = new Set();
    const uniqueReleaseGroups = allReleaseGroups.filter(rg => {
      if (uniqueIds.has(rg.id)) {
        return false;
      }
      uniqueIds.add(rg.id);
      return true;
    });
    
    console.log(`Fetched ${allReleaseGroups.length} total items, ${uniqueReleaseGroups.length} unique release groups`);

    if (uniqueReleaseGroups.length < expectedTotal) {
      console.warn(`Warning: Only fetched ${uniqueReleaseGroups.length} release groups, expected ${expectedTotal}`);
    } else {
      console.log(`Successfully fetched all ${uniqueReleaseGroups.length} release groups`);
    }

    // Normalize the data and return with collection name
    return {
      releaseGroups: normalizeReleaseGroups(uniqueReleaseGroups),
      collectionName
    };
  } catch (error) {
    console.error(`Critical error fetching collection:`, error);
    throw error;
  }
};
