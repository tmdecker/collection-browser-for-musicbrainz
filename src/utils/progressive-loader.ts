/**
 * @ai-file utility
 * @ai-description Progressive data loading utility for collection fetching with IndexedDB caching
 * @ai-dependencies ReleaseGroup type, IndexedDB utilities
 * @ai-features Cache-first loading, background refresh, collection name management
 */

import { ReleaseGroup } from '@/types/music';
import * as db from './db';
import { fetchAllReleaseGroupsInCollection, fetchAllReleaseGroupsInSeries } from './release-groups-helper';
import { loadPreferences, savePreferences } from './preference-migration';

// Track if background refresh is in progress
let isRefreshing = false;

/**
 * Load collection or series data with IndexedDB caching
 * Returns cached data if available or fetches from API
 * Automatically starts background refresh if cache is stale (>30 minutes)
 */
export async function getBasicData(collectionId: string, entityType?: 'collection' | 'series'): Promise<ReleaseGroup[]> {
  console.log('🚀 Progressive Loader: Loading basic data for ID:', collectionId, 'type:', entityType || 'collection');

  try {
    // Initialize database
    await db.initDatabase();

    // Check collection metadata
    console.log('🔍 Progressive Loader: Checking collection metadata...');
    const collectionMetadata = await db.getCollectionMetadata(collectionId);
    console.log('🔍 Progressive Loader: Collection metadata result:', collectionMetadata);

    // If we have complete cached data, return it
    if (collectionMetadata &&
        collectionMetadata.isComplete &&
        collectionMetadata.itemCount > 0) {

      console.log('🗃️ Using cached collection data from IndexedDB');
      const cachedData = await db.getCollection(collectionId);

      console.log('🎨 Sample cached album with cover:', cachedData[0]?.cover);

      // Update preferences with cached collection name
      if (collectionMetadata.name) {
        const preferences = loadPreferences();
        const currentName = preferences.metadata.collectionName;

        console.log(`💾 Loading cached collection name: "${collectionMetadata.name}" (current in prefs: "${currentName}")`);
        preferences.metadata.collectionName = collectionMetadata.name;
        savePreferences(preferences);

        // Dispatch event to update UI
        window.dispatchEvent(new CustomEvent('mb-preferences-updated', {
          detail: { collectionName: collectionMetadata.name }
        }));
        console.log(`📢 Dispatched mb-preferences-updated event from cache for: "${collectionMetadata.name}"`);
      } else {
        // Collection name not in cache (old format), fetch from API
        console.log('⚠️ Collection name not in cache metadata, fetching from API...');
        await fetchAndUpdateCollectionName(collectionId, entityType);
      }

      // Normalize cached data to ensure consistent structure
      const { normalizeReleaseGroups } = await import('./normalize-mb-data');
      const normalizedCachedData = normalizeReleaseGroups(cachedData);

      // Keep the cache in sync without re-downloading the whole collection on every visit
      if (collectionMetadata.lastUpdated) {
        const cacheAge = Date.now() - new Date(collectionMetadata.lastUpdated).getTime();
        if (cacheAge > FULL_REFRESH_INTERVAL_MS) {
          // Daily full refresh also picks up edits (genres, ratings) and add+remove swaps
          console.log('🔄 Cache is older than 24 hours, starting background refresh');
          refreshDataInBackground(collectionId);
        } else if (entityType !== 'series' && cacheAge > MIN_REFRESH_INTERVAL_MS) {
          // Cheap check: one request for the item count; refresh only when albums were added or removed
          checkCollectionCountInBackground(collectionId, collectionMetadata.itemCount);
        }
      }

      return normalizedCachedData;
    }

    // No valid cache, fetch from API
    console.log('🌐 No valid cache found, fetching from API');
    return await fetchAndCacheCollection(collectionId, entityType);
  } catch (error) {
    console.error('Failed to load basic data:', error);
    throw error;
  }
}

// A full collection reload costs one MusicBrainz request per 100 albums, so it runs at most daily
const FULL_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Never refresh more often than this, even when the item count differs (avoids loops)
const MIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
// Count checks per collection in this browser session (one per page load and interval)
const COUNT_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const lastCountCheck = new Map<string, number>();

/**
 * Compare the collection's item count on MusicBrainz with the cached count (one request)
 * and start a full background refresh only when they differ
 */
function checkCollectionCountInBackground(collectionId: string, cachedCount: number): void {
  const lastCheck = lastCountCheck.get(collectionId) ?? 0;
  if (Date.now() - lastCheck < COUNT_CHECK_INTERVAL_MS) return;
  lastCountCheck.set(collectionId, Date.now());

  fetch(`/api/musicbrainz/collection/${collectionId}?fmt=json`)
    .then(response => (response.ok ? response.json() : null))
    .then((data: { 'release-group-count'?: number } | null) => {
      const remoteCount = data?.['release-group-count'];
      if (typeof remoteCount !== 'number') return;
      if (remoteCount !== cachedCount) {
        console.log(`🔄 Collection changed on MusicBrainz (${cachedCount} → ${remoteCount} albums), starting background refresh`);
        refreshDataInBackground(collectionId);
      } else {
        console.log(`✅ Collection unchanged on MusicBrainz (${remoteCount} albums)`);
      }
    })
    .catch(error => console.warn('⚠️ Collection count check failed:', error));
}

/**
 * Fetch collection or series name from API and update preferences
 */
async function fetchAndUpdateCollectionName(collectionId: string, entityType?: 'collection' | 'series'): Promise<void> {
  try {
    const axios = (await import('axios')).default;
    const baseUrl = '/api/musicbrainz';
    const endpoint = entityType === 'series' ? 'series' : 'collection';

    const response = await axios.get(
      `${baseUrl}/${endpoint}/${collectionId}`,
      { params: { fmt: 'json' } }
    );

    const name = response.data.name || '';
    if (name) {
      console.log(`✨ Fetched ${entityType || 'collection'} name from API: "${name}"`);

      const preferences = loadPreferences();
      preferences.metadata.collectionName = name;
      savePreferences(preferences);

      // Dispatch event to update UI
      window.dispatchEvent(new CustomEvent('mb-preferences-updated', {
        detail: { collectionName: name }
      }));
      console.log(`📢 Dispatched mb-preferences-updated event for fetched name: "${name}"`);
    }
  } catch (err) {
    console.error(`Failed to fetch ${entityType || 'collection'} name from API:`, err);
  }
}

/**
 * Fetch collection or series from API and cache it
 */
async function fetchAndCacheCollection(collectionId: string, entityType?: 'collection' | 'series'): Promise<ReleaseGroup[]> {
  const userAgent = `${process.env.NEXT_PUBLIC_MUSICBRAINZ_APP_NAME} (mailto:${process.env.NEXT_PUBLIC_MUSICBRAINZ_CONTACT_EMAIL})`;

  // Callback to update collection/series name immediately when fetched
  const handleNameFetched = (name: string) => {
    const preferences = loadPreferences();
    const oldName = preferences.metadata.collectionName;
    preferences.metadata.collectionName = name;
    savePreferences(preferences);
    console.log(`💾 Immediately stored ${entityType || 'collection'} name: "${name}" (was: "${oldName}")`);

    // Dispatch event to notify React components of the update
    window.dispatchEvent(new CustomEvent('mb-preferences-updated', {
      detail: { collectionName: name }
    }));
    console.log(`📢 Dispatched mb-preferences-updated event for ${entityType || 'collection'}: "${name}"`);
  };

  // Route to correct fetcher based on entity type
  const { releaseGroups, collectionName } = entityType === 'series'
    ? await fetchAllReleaseGroupsInSeries(collectionId, userAgent, handleNameFetched)
    : await fetchAllReleaseGroupsInCollection(collectionId, userAgent, handleNameFetched);

  // Add cover art URLs to each release group BEFORE storing
  const apiData = releaseGroups.map(rg => ({
    ...rg,
    cover: `/api/coverart/release-group/${rg.id}/front`
  }));

  console.log('🎨 Added cover art URLs before storing. Sample:', apiData[0]?.cover);

  // Normalize API data to ensure consistent structure
  const { normalizeReleaseGroups } = await import('./normalize-mb-data');
  const normalizedApiData = normalizeReleaseGroups(apiData);

  // Store in cache (with cover URLs, normalized, collection name, and entity type)
  await db.storeCollection(normalizedApiData, collectionId, collectionName, entityType);

  // After storing series data, trigger background metadata enhancement
  if (entityType === 'series') {
    // Non-blocking: don't await
    setTimeout(() => {
      enhanceSeriesMetadata(normalizedApiData);
    }, 100);
  }

  return normalizedApiData;
}

/**
 * Force refresh collection data by clearing collection metadata and fetching fresh data
 * Used by manual refresh button to bypass cache while preserving individual album data
 */
export async function forceRefreshCollection(collectionId: string): Promise<ReleaseGroup[]> {
  console.log('🔄 Force refreshing collection:', collectionId);

  // Clear only collection metadata to force re-fetch (preserves album details cache)
  await db.clearCollectionMetadata(collectionId);

  // Fetch fresh data and cache it
  return await fetchAndCacheCollection(collectionId);
}

/**
 * Background enhancement: fetch genres/tags/ratings for series items
 * Updates both server cache (via API) and client IndexedDB
 */
export async function enhanceSeriesMetadata(releaseGroups: ReleaseGroup[]): Promise<void> {
  // Only enhance items missing metadata
  const needsEnhancement = releaseGroups.filter(
    rg => !rg.genres?.length && !rg.tags?.length && !rg.rating
  );

  if (needsEnhancement.length === 0) return;

  console.log(`🔄 Enhancing metadata for ${needsEnhancement.length} series items...`);

  let enhanced = 0;
  for (const rg of needsEnhancement) {
    try {
      const response = await fetch('/api/enhance-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mbid: rg.id })
      });

      if (response.ok) {
        const metadata = await response.json();
        // Update client-side IndexedDB
        await db.updateReleaseGroupMetadata(rg.id, {
          genres: metadata.genres,
          tags: metadata.tags,
          rating: metadata.rating
        });
        enhanced++;
      }
    } catch (error) {
      console.warn(`Failed to enhance ${rg.id}:`, error);
    }
  }

  // Dispatch event to notify UI
  window.dispatchEvent(new CustomEvent('mb-data-updated', {
    detail: { timestamp: new Date(), type: 'metadata-enhanced', count: enhanced }
  }));

  console.log(`✅ Metadata enhancement complete (${enhanced}/${needsEnhancement.length})`);
}

/**
 * Start a background refresh of the data without blocking UI
 */
export function refreshDataInBackground(collectionId: string): void {
  if (isRefreshing) {
    console.log('🔄 Background refresh already in progress, skipping');
    return;
  }

  isRefreshing = true;

  // Use setTimeout to move this off the main thread
  setTimeout(async () => {
    try {
      console.log('🔄 Starting background data refresh...');

      // Fetch fresh data from API
      const userAgent = `${process.env.NEXT_PUBLIC_MUSICBRAINZ_APP_NAME} (mailto:${process.env.NEXT_PUBLIC_MUSICBRAINZ_CONTACT_EMAIL})`;

      // Callback to update collection name immediately when fetched
      const handleCollectionNameFetched = (name: string) => {
        const preferences = loadPreferences();
        const oldName = preferences.metadata.collectionName;
        preferences.metadata.collectionName = name;
        savePreferences(preferences);
        console.log(`💾 Background refresh: Immediately updated collection name to "${name}" (was: "${oldName}")`);

        // Dispatch event to notify React components of the update
        window.dispatchEvent(new CustomEvent('mb-preferences-updated', {
          detail: { collectionName: name }
        }));
        console.log(`📢 Background refresh: Dispatched mb-preferences-updated event for collection: "${name}"`);
      };

      const { releaseGroups, collectionName } = await fetchAllReleaseGroupsInCollection(
        collectionId,
        userAgent,
        handleCollectionNameFetched
      );

      // Add cover art URLs to each release group BEFORE storing
      const freshData = releaseGroups.map(rg => ({
        ...rg,
        cover: `/api/coverart/release-group/${rg.id}/front`
      }));

      console.log('🎨 Background refresh: Added cover art URLs before storing. Sample:', freshData[0]?.cover);

      // Normalize fresh data to ensure consistent structure
      const { normalizeReleaseGroups } = await import('./normalize-mb-data');
      const normalizedFreshData = normalizeReleaseGroups(freshData);

      // Update cache with new data (including collection name)
      await db.storeCollection(normalizedFreshData, collectionId, collectionName);

      console.log('✅ Background data refresh completed successfully');

      // Dispatch an event to notify any listeners
      window.dispatchEvent(new CustomEvent('mb-data-updated', {
        detail: {
          timestamp: new Date(),
          itemCount: normalizedFreshData.length
        }
      }));
    } catch (error) {
      console.error('Background data refresh failed:', error);
    } finally {
      isRefreshing = false;
    }
  }, 100);
}
