/**
 * @ai-file utility
 * @ai-description Fetches MusicBrainz collections and series with pagination and rate limiting
 * @ai-dependencies mbApi from api.ts, normalizeReleaseGroups from normalize-mb-data
 * @ai-features
 * - Paginated collection fetching with 100-item limit per page, for release group collections and
 *   release collections (each release becomes a release item, see release-items)
 * - Single-request series fetching with ordering support, for release group series and release series
 * - Rate limiting is enforced server-side by the /api/musicbrainz proxy
 * - Collection/series name extraction with early callback support
 */

import { ReleaseGroup } from '@/types/music';
import { normalizeReleaseGroups } from './normalize-mb-data';
import { mbApi } from './api';
import { releaseToItem } from './release-items';

const PAGE_SIZE = 100;
const MAX_PAGE_RETRIES = 5;

// What a collection's entity type means for loading it
interface CollectionKind {
  /** Browse endpoint and the key of its list in the answer */
  endpoint: '/release-group' | '/release';
  listKey: 'release-groups' | 'releases';
  countKey: 'release-group-count' | 'release-count';
  inc: string;
  toItem: (entity: any) => any;
}

// Genres, tags and ratings belong to the release group: MusicBrainz puts them into each release's
// release group, so one browse brings everything the grid and the filters need
export const RELEASE_COLLECTION_INC = 'artist-credits+release-groups+media+labels+genres+tags+ratings';

const RELEASE_GROUP_COLLECTION: CollectionKind = {
  endpoint: '/release-group',
  listKey: 'release-groups',
  countKey: 'release-group-count',
  inc: 'artist-credits+genres+tags+ratings',
  toItem: entity => entity,
};

const RELEASE_COLLECTION: CollectionKind = {
  endpoint: '/release',
  listKey: 'releases',
  countKey: 'release-count',
  inc: RELEASE_COLLECTION_INC,
  toItem: releaseToItem,
};

/**
 * Fetch every album of a MusicBrainz collection using pagination: the release groups of a release group
 * collection, or the releases of a release collection as release items
 * (rate limiting is enforced server-side by the /api/musicbrainz proxy)
 *
 * @param collectionId - MusicBrainz collection ID
 * @param userAgent - User agent string for API requests (deprecated - handled by API proxy)
 * @param onCollectionNameFetched - Optional callback called immediately when collection name is fetched
 * @param options.fresh - Ask MusicBrainz for live pages instead of the server's copy (refreshes use this);
 *   without it, a server copy whose album count no longer matches the collection is fetched again live
 * @returns Object containing the albums and the collection name
 */
export const fetchAllReleaseGroupsInCollection = async (
  collectionId: string,
  userAgent: string = 'MusicLibraryViewer/1.0.0 (mailto:your.email@example.com)',
  onCollectionNameFetched?: (name: string) => void,
  { fresh = false }: { fresh?: boolean } = {}
): Promise<{ releaseGroups: ReleaseGroup[], collectionName: string }> => {
  try {
    // The collection itself: name, entity type and item count
    const collectionData = (await mbApi.get(`/collection/${collectionId}`, { params: { fmt: 'json' } })).data;
    const kind = collectionData['entity-type'] === 'release' ? RELEASE_COLLECTION : RELEASE_GROUP_COLLECTION;
    const expectedTotal = collectionData[kind.countKey] || 0;
    const collectionName = collectionData.name || '';
    console.log(`Collection "${collectionName}" reports having ${expectedTotal} ${kind.listKey}`);

    if (onCollectionNameFetched && collectionName) {
      onCollectionNameFetched(collectionName);
    }

    const pagesNeeded = Math.ceil(expectedTotal / PAGE_SIZE);
    const allItems: any[] = [];
    let usedServerCopy = false; // Some page came from the server's copy instead of MusicBrainz

    for (let page = 0; page < pagesNeeded; page++) {
      const offset = page * PAGE_SIZE;
      let retryCount = 0;
      let success = false;

      while (retryCount < MAX_PAGE_RETRIES && !success) {
        try {
          const response = await mbApi.get(kind.endpoint, {
            params: { fmt: 'json', collection: collectionId, inc: kind.inc, limit: PAGE_SIZE, offset },
            headers: fresh ? { 'x-mb-refresh': '1' } : undefined,
            timeout: 30000,
          });

          if (response.headers?.['x-mb-cache'] === 'hit') usedServerCopy = true;
          const items = response.data[kind.listKey] || [];
          console.log(`Page ${page + 1}/${pagesNeeded}: got ${items.length} items at offset ${offset}`);
          allItems.push(...items);
          success = true;
        } catch (error: any) {
          retryCount++;
          const retryAfter = error.response?.status === 503 && error.response.headers['retry-after']
            ? parseInt(error.response.headers['retry-after'], 10) * 1000
            : 0;
          const backoffDelay = retryAfter || 1000 * Math.pow(2, retryCount - 1);
          console.log(`Page ${page + 1} failed, attempt ${retryCount}. Waiting ${backoffDelay / 1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));

          if (retryCount === MAX_PAGE_RETRIES) {
            console.error(`Failed to fetch page ${page + 1} after ${MAX_PAGE_RETRIES} attempts.`);
          }
        }
      }

      if (!success && allItems.length > 0) {
        console.warn(`Skipping page ${page + 1} after ${MAX_PAGE_RETRIES} failed attempts. Continuing to next page.`);
      }
    }

    // Remove any duplicates by ID
    const uniqueIds = new Set();
    const uniqueItems = allItems.filter(item => {
      if (uniqueIds.has(item.id)) return false;
      uniqueIds.add(item.id);
      return true;
    });

    // The server's copy is older than the collection (albums added or removed since): load it live instead
    if (usedServerCopy && uniqueItems.length !== expectedTotal) {
      console.log(`Server copy has ${uniqueItems.length} albums, collection has ${expectedTotal}: loading live`);
      return fetchAllReleaseGroupsInCollection(collectionId, userAgent, undefined, { fresh: true });
    }

    if (uniqueItems.length < expectedTotal) {
      console.warn(`Warning: Only fetched ${uniqueItems.length} of ${expectedTotal} ${kind.listKey}`);
    }

    return {
      releaseGroups: normalizeReleaseGroups(uniqueItems.map(kind.toItem)),
      collectionName
    };
  } catch (error) {
    console.error(`Critical error fetching collection:`, error);
    throw error;
  }
};

// Release group and release relations in one request, so either kind of series loads the same way
const SERIES_INC = 'release-group-rels+release-rels+artist-credits';

/**
 * Fetch all albums in a MusicBrainz series: the release groups of a release group series, the releases
 * of a release series as release items (their release group is looked up later, see progressive-loader)
 * Series API returns all items in one response (no pagination needed)
 *
 * @param seriesId - MusicBrainz series ID
 * @param userAgent - User agent string for API requests (deprecated - handled by API proxy)
 * @param onSeriesNameFetched - Optional callback called immediately when series name is fetched
 * @returns Object containing the albums and the series name
 */
export const fetchAllReleaseGroupsInSeries = async (
  seriesId: string,
  userAgent: string = 'MusicLibraryViewer/1.0.0 (mailto:your.email@example.com)',
  onSeriesNameFetched?: (name: string) => void
): Promise<{ releaseGroups: ReleaseGroup[], collectionName: string }> => {
  try {
    const seriesData = (await mbApi.get(`/series/${seriesId}`, { params: { fmt: 'json', inc: SERIES_INC } })).data;

    const seriesName = seriesData.name || '';
    console.log(`Series "${seriesName}" with ${seriesData.relations?.length || 0} relations`);

    if (onSeriesNameFetched && seriesName) {
      onSeriesNameFetched(seriesName);
    }

    const items = [];
    for (const relation of seriesData.relations || []) {
      if (relation.type !== 'part of') continue;
      const order = relation['ordering-key'] || relation.ordering_key;
      if (relation['target-type'] === 'release_group') {
        const releaseGroup = relation['release-group'] || relation.release_group;
        if (releaseGroup) items.push({ ...releaseGroup, seriesOrder: order });
      } else if (relation['target-type'] === 'release' && relation.release) {
        items.push({ ...releaseToItem(relation.release), seriesOrder: order });
      }
    }

    console.log(`Extracted ${items.length} albums from series`);

    return {
      releaseGroups: normalizeReleaseGroups(items),
      collectionName: seriesName
    };
  } catch (error) {
    console.error(`Critical error fetching series:`, error);
    throw error;
  }
};
