/**
 * @ai-file utility
 * @ai-description IndexedDB database manager for client-side data caching with memory fallback
 * @ai-dependencies ReleaseGroup, StreamingLinks types
 * @ai-features
 * - Collection metadata storage with album IDs and collection names
 * - Individual album (release group) caching
 * - Streaming links caching with 7-day TTL
 * - Memory fallback when IndexedDB fails
 */

import { ReleaseGroup, StreamingLinks } from '@/types/music';

// Constants
const DB_NAME = 'musicLibraryDb';
const DB_VERSION = 6; // Phase 2: Added STREAMING_LINKS_STORE for persistent streaming link caching
const COLLECTION_STORE = 'collection';
const ALBUM_STORE = 'albums';
const META_STORE = 'meta';
const STREAMING_LINKS_STORE = 'streamingLinks';

// Memory fallback when IndexedDB fails
const memoryCache = {
  collections: new Map<string, CollectionMetadata>(),
  albums: new Map<string, ReleaseGroup>(),
  streamingLinks: new Map<string, StreamingLinksCache>(),
  meta: {
    cacheStatus: {
      lastUpdated: null as Date | null,
      itemCount: 0,
      isComplete: false,
      collectionId: null as string | null
    }
  }
};

// Collection metadata interface
export interface CollectionMetadata {
  id: string;
  name?: string;  // Collection or series name from MusicBrainz API
  entityType?: 'collection' | 'series';  // Type of entity (collection or series)
  albumIds: string[];
  lastUpdated: Date | null;
  itemCount: number;
  isComplete: boolean;
}

// Streaming links cache interface
export interface StreamingLinksCache {
  url: string;              // Primary key (source URL)
  streamingLinks: StreamingLinks;
  userCountry: string;
  timestamp: number;
  expiresAt: number;        // Calculated expiration (1 week)
}

// Cache status interface (for backward compatibility)
export interface CacheStatus {
  lastUpdated: Date | null;
  itemCount: number;
  isComplete: boolean;
  collectionId: string | null;
}

// Track if we're using the memory fallback
let usingMemoryFallback = false;

// Generic database open function with error handling
const openDatabase = (): Promise<IDBDatabase> => {
  if (usingMemoryFallback) {
    return Promise.reject(new Error('Using memory fallback'));
  }

  return new Promise((resolve, reject) => {
    // Check if IndexedDB is supported
    if (!window.indexedDB) {
      usingMemoryFallback = true;
      reject(new Error('IndexedDB not supported'));
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      // Handle database creation/upgrade
      request.onupgradeneeded = (event) => {
        try {
          const db = request.result;

          // Create collection store (for bulk data)
          if (!db.objectStoreNames.contains(COLLECTION_STORE)) {
            db.createObjectStore(COLLECTION_STORE, { keyPath: 'id' });
            // No complex indexes to avoid browser compatibility issues
          }

          // Create albums store (for detailed album data)
          if (!db.objectStoreNames.contains(ALBUM_STORE)) {
            db.createObjectStore(ALBUM_STORE, { keyPath: 'id' });
          }

          // Create metadata store
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: 'id' });
          }

          // Create streaming links store (Phase 2: persistent caching)
          if (!db.objectStoreNames.contains(STREAMING_LINKS_STORE)) {
            db.createObjectStore(STREAMING_LINKS_STORE, { keyPath: 'url' });
            console.log('🗃️ Created STREAMING_LINKS_STORE for persistent caching (1-week TTL)');
          }
        } catch (error) {
          console.error('Error during database upgrade:', error);
          // Don't throw - just log the error
        }
      };

      // Handle success
      request.onsuccess = () => {
        resolve(request.result);
      };

      // Handle errors
      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        usingMemoryFallback = true;
        reject(request.error);
      };
      
      // Handle blocked events
      request.onblocked = () => {
        console.error('⚠️ IndexedDB blocked - cache will use memory until page reload. Close other tabs with this app open to restore persistent caching.');
        usingMemoryFallback = true;
        reject(new Error('Database blocked'));
      };
    } catch (error) {
      console.error('Critical IndexedDB error:', error);
      usingMemoryFallback = true;
      reject(error);
    }
  });
};

/**
 * Initialize the database and set up cache metadata
 */
export const initDatabase = async (): Promise<void> => {
  try {
    if (usingMemoryFallback) {
      console.log('📝 Using memory storage (fallback mode)');
      return;
    }

    const db = await openDatabase();
    
    // Initialize metadata if not exists
    try {
      const tx = db.transaction([META_STORE], 'readwrite');
      const store = tx.objectStore(META_STORE);
      
      const getRequest = store.get('cacheStatus');
      
      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          store.put({
            id: 'cacheStatus',
            lastUpdated: null,
            itemCount: 0,
            isComplete: false,
            collectionId: null
          });
        }
      };
      
      tx.oncomplete = () => {
        db.close();
        console.log('🗃️ IndexedDB initialized successfully');
      };
    } catch (error) {
      console.error('Error initializing metadata store:', error);
      db.close();
      usingMemoryFallback = true;
    }
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    usingMemoryFallback = true;
    console.log('📝 Using memory storage as fallback');
  }
};

/**
 * Store a collection and its release groups in the database using the new schema
 */
export const storeCollection = async (
  releaseGroups: ReleaseGroup[],
  collectionId: string,
  collectionName?: string,
  entityType?: 'collection' | 'series'
): Promise<void> => {
  // If using memory fallback, store in memory
  if (usingMemoryFallback) {
    // Store collection metadata
    const collectionMetadata: CollectionMetadata = {
      id: collectionId,
      name: collectionName,
      entityType,
      albumIds: releaseGroups.map(rg => rg.id),
      lastUpdated: new Date(),
      itemCount: releaseGroups.length,
      isComplete: true
    };
    memoryCache.collections.set(collectionId, collectionMetadata);

    // Store individual albums
    console.log(`📝 Storing ${releaseGroups.length} albums in memory cache`);
    releaseGroups.forEach(rg => {
      memoryCache.albums.set(rg.id, rg);
    });

    // Update legacy cache status for backward compatibility
    memoryCache.meta.cacheStatus = {
      lastUpdated: new Date(),
      itemCount: releaseGroups.length,
      isComplete: true,
      collectionId
    };

    console.log(`📝 Stored collection ${collectionId} with ${releaseGroups.length} albums in memory cache`);
    return;
  }

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([COLLECTION_STORE, ALBUM_STORE, META_STORE], 'readwrite');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const collectionStore = transaction.objectStore(COLLECTION_STORE);
        const albumStore = transaction.objectStore(ALBUM_STORE);
        const metaStore = transaction.objectStore(META_STORE);

        // Store collection metadata
        const collectionMetadata = {
          id: collectionId,
          name: collectionName,
          entityType,
          albumIds: releaseGroups.map(rg => rg.id),
          lastUpdated: new Date().toISOString(), // Store as string for IndexedDB compatibility
          itemCount: releaseGroups.length,
          isComplete: true
        };

        console.log(`💾 Storing collection metadata for ${collectionId} (${collectionName}):`, collectionMetadata);
        collectionStore.put(collectionMetadata);

        // Store individual albums
        console.log(`💾 Storing ${releaseGroups.length} individual albums in ALBUM_STORE`);
        let completed = 0;
        for (const releaseGroup of releaseGroups) {
          const request = albumStore.put(releaseGroup);
          request.onsuccess = () => {
            completed++;
            console.log(`💾 Stored album ${releaseGroup.id} (${completed}/${releaseGroups.length})`);
            if (completed === releaseGroups.length) {
              console.log('💾 All albums stored, updating legacy metadata...');
              // Update legacy metadata for backward compatibility
              metaStore.put({
                id: 'cacheStatus',
                lastUpdated: new Date().toISOString(),
                itemCount: releaseGroups.length,
                isComplete: true,
                collectionId
              });
            }
          };
          request.onerror = () => {
            console.error(`❌ Failed to store album ${releaseGroup.id}:`, request.error);
          };
        }

        transaction.oncomplete = () => {
          db.close();
          console.log(`🗃️ Stored collection ${collectionId} with ${releaseGroups.length} albums in IndexedDB`);
          resolve();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to store collection in IndexedDB:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return storeCollection(releaseGroups, collectionId);
  }
};

/**
 * Clear collection metadata to force re-fetch while preserving individual album data
 */
export const clearCollectionMetadata = async (collectionId: string): Promise<void> => {
  // If using memory fallback, delete from memory
  if (usingMemoryFallback) {
    memoryCache.collections.delete(collectionId);
    console.log(`📝 Cleared collection metadata for ${collectionId} from memory cache`);
    return;
  }

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([COLLECTION_STORE], 'readwrite');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const store = transaction.objectStore(COLLECTION_STORE);
        const request = store.delete(collectionId);

        request.onsuccess = () => {
          console.log(`🗃️ Cleared collection metadata for ${collectionId} from IndexedDB`);
        };

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to clear collection metadata from IndexedDB:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return clearCollectionMetadata(collectionId);
  }
};

/**
 * Retrieve collection metadata
 */
export const getCollectionMetadata = async (collectionId: string): Promise<CollectionMetadata | null> => {
  // If using memory fallback, get from memory
  if (usingMemoryFallback) {
    const metadata = memoryCache.collections.get(collectionId) || null;
    if (metadata) {
      console.log(`📝 Retrieved collection metadata for ${collectionId} from memory cache`);
    }
    return metadata;
  }

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([COLLECTION_STORE], 'readonly');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const store = transaction.objectStore(COLLECTION_STORE);
        const request = store.get(collectionId);

        request.onsuccess = () => {
          const result = request.result || null;
          if (result) {
            console.log(`🗃️ Retrieved collection metadata for ${collectionId} from IndexedDB`);
            // Convert lastUpdated string back to Date
            if (result.lastUpdated && typeof result.lastUpdated === 'string') {
              result.lastUpdated = new Date(result.lastUpdated);
            }
          } else {
            console.log(`🗃️ No collection metadata found for ${collectionId}`);
          }
          resolve(result);
        };

        transaction.oncomplete = () => {
          db.close();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to retrieve collection metadata from IndexedDB:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return getCollectionMetadata(collectionId);
  }
};

/**
 * Retrieve albums for a collection using the new schema
 */
export const getCollection = async (collectionId?: string): Promise<ReleaseGroup[]> => {
  // For backward compatibility, try to get collection ID from cache status if not provided
  if (!collectionId) {
    const cacheStatus = await getCacheStatus();
    if (cacheStatus.collectionId) {
      collectionId = cacheStatus.collectionId;
    } else {
      console.warn('No collection ID provided and none found in cache');
      return [];
    }
  }

  // Get collection metadata first
  const metadata = await getCollectionMetadata(collectionId);
  if (!metadata) {
    console.log('No collection metadata found');
    return [];
  }

  // Get all albums for this collection
  const albums: ReleaseGroup[] = [];
  for (const albumId of metadata.albumIds) {
    const album = await getReleaseGroup(albumId);
    if (album) {
      albums.push(album);
    }
  }

  console.log(`🗃️ Retrieved ${albums.length} albums for collection ${collectionId}`);
  return albums;
};

/**
 * Store detailed information about a single release group
 */
export const storeReleaseGroup = async (releaseGroup: ReleaseGroup): Promise<void> => {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  // Add cache metadata
  const releaseGroupWithTimestamp: ReleaseGroup = {
    ...releaseGroup,
    _cachedAt: now,
    _expiresAt: now + thirtyDays
  };

  // If using memory fallback, store in memory
  if (usingMemoryFallback) {
    memoryCache.albums.set(releaseGroup.id, releaseGroupWithTimestamp);
    console.log(`📝 Stored details for release group ${releaseGroup.id} in memory cache (30-day TTL)`);
    return;
  }

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([ALBUM_STORE], 'readwrite');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const store = transaction.objectStore(ALBUM_STORE);

        const request = store.put(releaseGroupWithTimestamp);

        request.onsuccess = () => {
          console.log(`🗃️ Stored details for release group ${releaseGroup.id} (expires in 30 days)`);
        };

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to store release group in IndexedDB:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return storeReleaseGroup(releaseGroup);
  }
};

/**
 * Update metadata (genres, tags, rating) for an existing release group
 * Preserves existing fields, only updates metadata fields
 */
export const updateReleaseGroupMetadata = async (
  id: string,
  metadata: { genres?: (string | Genre)[]; tags?: (string | Tag)[]; rating?: Rating }
): Promise<void> => {
  const existing = await getReleaseGroup(id);
  if (!existing) return;

  await storeReleaseGroup({
    ...existing,
    ...metadata
  });
};

/**
 * Retrieve detailed information about a single release group
 * Returns null if not found or expired
 */
export const getReleaseGroup = async (id: string): Promise<ReleaseGroup | null> => {
  // If using memory fallback, get from memory
  if (usingMemoryFallback) {
    const cached = memoryCache.albums.get(id);
    if (cached) {
      // Check expiration
      if (cached._expiresAt && Date.now() < cached._expiresAt) {
        console.log(`📝 Cache hit for release group ${id} (memory)`);
        return cached;
      } else if (cached._expiresAt) {
        // Expired, remove from cache
        memoryCache.albums.delete(id);
        console.log(`📝 Cache expired for release group ${id} (memory)`);
        return null;
      } else {
        // Legacy cache entry without expiry - return it but log warning
        console.log(`📝 Retrieved release group ${id} from memory cache (no expiry)`);
        return cached;
      }
    } else {
      console.log(`📝 No details found for release group ${id} in memory cache`);
    }
    return null;
  }

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([ALBUM_STORE], 'readonly');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const store = transaction.objectStore(ALBUM_STORE);

        const request = store.get(id);

        request.onsuccess = () => {
          const cached = request.result as ReleaseGroup | undefined;

          if (cached) {
            // Check expiration
            if (cached._expiresAt && Date.now() < cached._expiresAt) {
              console.log(`🗃️ Cache hit for release group ${id}`);
              resolve(cached);
            } else if (cached._expiresAt) {
              // Expired
              console.log(`🗃️ Cache expired for release group ${id}`);
              resolve(null);
            } else {
              // Legacy cache entry without expiry - return it but log warning
              console.log(`🗃️ Retrieved release group ${id} (no expiry)`);
              resolve(cached);
            }
          } else {
            console.log(`🗃️ No details found for release group ${id} in IndexedDB`);
            resolve(null);
          }
        };

        transaction.oncomplete = () => {
          db.close();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to retrieve release group from IndexedDB:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return getReleaseGroup(id);
  }
};

/**
 * Retrieve the cache status metadata
 */
export const getCacheStatus = async (): Promise<CacheStatus> => {
  const defaultStatus: CacheStatus = {
    lastUpdated: null,
    itemCount: 0,
    isComplete: false,
    collectionId: null
  };
  
  // If using memory fallback, get from memory
  if (usingMemoryFallback) {
    return memoryCache.meta.cacheStatus;
  }

  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([META_STORE], 'readonly');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const store = transaction.objectStore(META_STORE);
        
        const request = store.get('cacheStatus');
        
        request.onsuccess = () => {
          const result = request.result || defaultStatus;
          // Parse lastUpdated string back to Date if it exists
          if (result && result.lastUpdated && typeof result.lastUpdated === 'string') {
            result.lastUpdated = new Date(result.lastUpdated);
          }
          resolve(result);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to retrieve cache status from IndexedDB:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return getCacheStatus();
  }
};

/**
 * Update cache metadata
 */
export const updateCacheMetadata = async (status: Partial<CacheStatus>): Promise<void> => {
  // If using memory fallback, update memory
  if (usingMemoryFallback) {
    memoryCache.meta.cacheStatus = {
      ...memoryCache.meta.cacheStatus,
      ...status
    };
    console.log('📝 Updated cache metadata in memory');
    return;
  }

  try {
    // Get current status first
    const currentStatus = await getCacheStatus();
    
    // Merge with new status
    const updatedStatus = {
      ...currentStatus,
      ...status
    };
    
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([META_STORE], 'readwrite');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const store = transaction.objectStore(META_STORE);
        
        const request = store.put({
          id: 'cacheStatus',
          ...updatedStatus
        });
        
        request.onsuccess = () => {
          console.log('🗃️ Updated cache metadata');
        };
        
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to update cache metadata:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return updateCacheMetadata(status);
  }
};

/**
 * Clear the entire cache
 */
export const clearCache = async (): Promise<void> => {
  // If using memory fallback, clear memory
  if (usingMemoryFallback) {
    memoryCache.collections.clear();
    memoryCache.albums.clear();
    memoryCache.streamingLinks.clear();
    memoryCache.meta.cacheStatus = {
      lastUpdated: null,
      itemCount: 0,
      isComplete: false,
      collectionId: null
    };
    console.log('📝 Cleared memory cache');
    return;
  }

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([COLLECTION_STORE, ALBUM_STORE, META_STORE, STREAMING_LINKS_STORE], 'readwrite');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        transaction.objectStore(COLLECTION_STORE).clear();
        transaction.objectStore(ALBUM_STORE).clear();
        transaction.objectStore(STREAMING_LINKS_STORE).clear();

        // Reset metadata
        const request = transaction.objectStore(META_STORE).put({
          id: 'cacheStatus',
          lastUpdated: null,
          itemCount: 0,
          isComplete: false,
          collectionId: null
        });

        request.onsuccess = () => {
          console.log('🗃️ Cache cleared successfully');
        };

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to clear cache:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return clearCache();
  }
};

/**
 * Store streaming links in IndexedDB cache with 1-week TTL
 */
export const storeStreamingLinks = async (
  url: string,
  streamingLinks: StreamingLinks,
  userCountry: string = 'DE'
): Promise<void> => {
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

  const cacheEntry: StreamingLinksCache = {
    url,
    streamingLinks,
    userCountry,
    timestamp: now,
    expiresAt: now + oneWeek
  };

  // If using memory fallback, store in memory
  if (usingMemoryFallback) {
    memoryCache.streamingLinks.set(url, cacheEntry);
    console.log(`📝 Stored streaming links for ${url} in memory cache (1-week TTL)`);
    return;
  }

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STREAMING_LINKS_STORE], 'readwrite');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const store = transaction.objectStore(STREAMING_LINKS_STORE);
        const request = store.put(cacheEntry);

        request.onsuccess = () => {
          console.log(`🗃️ Stored streaming links for ${url} in IndexedDB (expires in 1 week)`);
        };

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to store streaming links in IndexedDB:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return storeStreamingLinks(url, streamingLinks, userCountry);
  }
};

/**
 * Retrieve streaming links from IndexedDB cache
 * Returns null if not found or expired
 */
export const getStreamingLinks = async (
  url: string,
  userCountry: string = 'DE'
): Promise<StreamingLinks | null> => {
  // If using memory fallback, get from memory
  if (usingMemoryFallback) {
    const cached = memoryCache.streamingLinks.get(url);
    if (cached) {
      // Check expiration
      if (Date.now() < cached.expiresAt) {
        console.log(`📝 Cache hit for streaming links: ${url} (memory)`);
        return cached.streamingLinks;
      } else {
        // Expired, remove from cache
        memoryCache.streamingLinks.delete(url);
        console.log(`📝 Cache expired for streaming links: ${url} (memory)`);
      }
    }
    return null;
  }

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STREAMING_LINKS_STORE], 'readonly');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const store = transaction.objectStore(STREAMING_LINKS_STORE);
        const request = store.get(url);

        request.onsuccess = () => {
          const cached = request.result as StreamingLinksCache | undefined;

          if (cached) {
            // Check expiration
            if (Date.now() < cached.expiresAt) {
              console.log(`🗃️ Cache hit for streaming links: ${url} (IndexedDB)`);
              resolve(cached.streamingLinks);
            } else {
              // Expired, clean up
              console.log(`🗃️ Cache expired for streaming links: ${url} (IndexedDB)`);
              // Note: Cleanup happens in background, return null for now
              resolve(null);
            }
          } else {
            console.log(`🗃️ Cache miss for streaming links: ${url}`);
            resolve(null);
          }
        };

        transaction.oncomplete = () => {
          db.close();
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to retrieve streaming links from IndexedDB:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return getStreamingLinks(url, userCountry);
  }
};

/**
 * Clean up expired streaming links from cache
 * Should be called periodically for housekeeping
 */
export const cleanExpiredStreamingLinks = async (): Promise<number> => {
  const now = Date.now();
  let cleanedCount = 0;

  // If using memory fallback, clean memory
  if (usingMemoryFallback) {
    for (const [url, cached] of Array.from(memoryCache.streamingLinks.entries())) {
      if (now >= cached.expiresAt) {
        memoryCache.streamingLinks.delete(url);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`📝 Cleaned ${cleanedCount} expired streaming links from memory cache`);
    }
    return cleanedCount;
  }

  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STREAMING_LINKS_STORE], 'readwrite');
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        const store = transaction.objectStore(STREAMING_LINKS_STORE);
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const cached = cursor.value as StreamingLinksCache;
            if (now >= cached.expiresAt) {
              cursor.delete();
              cleanedCount++;
            }
            cursor.continue();
          }
        };

        transaction.oncomplete = () => {
          db.close();
          if (cleanedCount > 0) {
            console.log(`🗃️ Cleaned ${cleanedCount} expired streaming links from IndexedDB`);
          }
          resolve(cleanedCount);
        };
      } catch (error) {
        console.error('Error in transaction:', error);
        db.close();
        reject(error);
      }
    });
  } catch (error) {
    console.error('Failed to clean expired streaming links:', error);
    // Fall back to memory cache
    usingMemoryFallback = true;
    return cleanExpiredStreamingLinks();
  }
};
