# IndexedDB Cache Management

This document provides comprehensive documentation for the IndexedDB caching system used by the Music Library Viewer.

## Overview

The application uses IndexedDB as the primary caching mechanism to provide:
- Immediate data display on app startup
- Offline functionality
- Reduced API calls to respect MusicBrainz rate limits
- Background data synchronization

## Database Schema

### Version History
- **Version 1-2**: Initial implementation
- **Version 3**: Introduced separated collection/album stores
- **Version 4**: Fixed cover art URL persistence
- **Version 5**: Optimized caching flow
- **Version 6**: Current version with streaming links persistent cache (Phase 2)

### Current Schema (Version 6)

#### COLLECTION_STORE
Stores collection metadata and membership information.

```typescript
interface CollectionMetadata {
  id: string;           // Collection ID (primary key)
  albumIds: string[];   // Array of album MBIDs in this collection
  lastUpdated: Date | null;
  itemCount: number;
  isComplete: boolean;
}
```

**Purpose**: Track which albums belong to which collections, enabling multiple collection support and cache invalidation.

#### ALBUM_STORE
Stores complete album information, shared across collections.

```typescript
interface ReleaseGroup {
  id: string;                    // Album MBID (primary key)
  title: string;
  artist_credit: ArtistCredit[];
  first_release_date: string;
  cover: string;                 // Cover art URL
  genres?: Genre[];
  tags?: Tag[];
  releases?: Release[];          // Full detailed data
  // ... other properties
}
```

**Purpose**: Store both basic and detailed album data, deduplicated across collections.

#### STREAMING_LINKS_STORE
Stores Odesli API responses for streaming platform links.

```typescript
interface StreamingLinksCache {
  url: string;              // Source URL (primary key)
  streamingLinks: StreamingLinks;
  userCountry: string;
  timestamp: number;
  expiresAt: number;        // Expiration timestamp (1 week)
}
```

**Purpose**: Cache streaming links with 1-week TTL to minimize API calls and comply with Odesli rate limits.

## Data Flow Architecture

### Initial Load Process

```
1. App starts → useAlbums hook → Progressive Loader
2. Check COLLECTION_STORE for metadata
3. If found and complete:
   - Load album IDs from collection metadata
   - Fetch albums from ALBUM_STORE by IDs
   - Display immediately
   - Background refresh if >30min old
4. If not found:
   - Fetch from MusicBrainz API
   - Add cover URLs to data
   - Store in both COLLECTION_STORE and ALBUM_STORE
   - Display results
```

### Album Details Flow

```
1. User clicks album → fetchAlbumDetails
2. Check ALBUM_STORE for cached data
3. If found:
   - Display basic data immediately
   - If detailed data missing, fetch in background
4. If not found:
   - Check memory fallback
   - Fetch from API if needed
```

### Streaming Links Flow (Phase 2)

```
1. Album details loaded → fetchStreamingLinks
2. Check STREAMING_LINKS_STORE for cached links by URL
3. Check for cached failures (URLs that previously failed with 400/404)
4. If found and fresh (< 1 week):
   - Display cached links immediately (no skeleton, no fade-in)
   - Skip known-bad URLs immediately
5. If not found or expired:
   - Try URLs in priority order (user preferences first)
   - Fetch from Odesli API (server enforces rate limit)
   - Store successful results in STREAMING_LINKS_STORE (1-week TTL)
   - Cache failures (400/404 errors) to skip on future attempts
   - Display links with fade-in animation
```

## Key Implementation Details

### Cover Art Integration

Cover art URLs are added **before** storing in IndexedDB to ensure persistence:

```typescript
// CORRECT: Add cover URLs before storing
const apiData = releaseGroups.map(rg => ({
  ...rg,
  cover: `/api/coverart/release-group/${rg.id}/front`
}));
await db.storeCollection(apiData, this.collectionId);

// INCORRECT: Adding after retrieval (not persistent)
const cachedData = await db.getCollection(collectionId);
return cachedData.map(album => ({ ...album, cover: generateCoverUrl(album.id) }));
```

### Cache Freshness Strategy

#### Collection/Album Cache
- **Fresh threshold**: 30 minutes
- **Background refresh**: Triggered when cache is stale but still usable
- **Full refresh**: When cache is missing or corrupted
- **Event notification**: `mb-data-updated` event dispatched on successful background refresh

#### Streaming Links Cache (Phase 2)
- **TTL**: 1 week (604,800,000 ms)
- **Rationale**: Streaming platform URLs are stable; albums rarely get new platforms
- **Expiration check**: Client-side on every cache read
- **Cleanup**: Periodic background cleanup via `cleanExpiredStreamingLinks()`
- **Failure Caching**: Invalid URLs (400/404 errors) are cached with `:failed` suffix to prevent retries
- **Animation**: Fade-in animation only when freshly fetched; instant display when cached

### Progressive Loading Pattern

The system prioritizes immediate user experience:

1. **Basic data first**: Title, artist, cover art, release date
2. **Details on-demand**: Track listings, streaming links, full metadata
3. **Background enhancement**: Details fetched while user browses

## API Integration

### Direct API Calls

The Progressive Loader bypasses the collection-handler to avoid caching conflicts:

```typescript
// Direct call to avoid cache bypass issues
const releaseGroups = await fetchAllReleaseGroupsInCollection(
  this.collectionId,
  userAgent
);
```

### Rate Limit Compliance

- Respects MusicBrainz 1 request/second limit
- Uses cached data to minimize API calls
- Background refreshes spread out over time

## Error Handling

### IndexedDB Failures

1. **Database access errors**: Fall back to memory cache
2. **Storage quota exceeded**: Clear old cache data
3. **Corruption**: Bump database version and rebuild

### Memory Fallbacks

```typescript
// Memory fallback when IndexedDB fails
const existingAlbum = albums.find(a => a.id === albumId);
if (existingAlbum && !selectedAlbumDetails) {
  console.log('Using basic album data from memory as fallback');
  setSelectedAlbumDetails(existingAlbum);
}
```

## Cache Management Functions

### Core Functions

- `initDatabase()`: Initialize IndexedDB with current schema
- `storeCollection(albums, collectionId)`: Store albums with metadata
- `getCollection(collectionId)`: Retrieve albums for a collection
- `getCollectionMetadata(collectionId)`: Get collection metadata only
- `storeReleaseGroup(album)`: Store/update individual album
- `getReleaseGroup(albumId)`: Retrieve individual album

### Streaming Links Functions (Phase 2)

- `storeStreamingLinks(url, links, country)`: Cache streaming links with 1-week TTL
- `getStreamingLinks(url, country)`: Retrieve cached streaming links (checks expiration)
- `cleanExpiredStreamingLinks()`: Remove expired streaming links from cache
- **Failure caching**: Failed URLs stored with `:failed` suffix to prevent repeated API calls

### Utility Functions

- `clearCache()`: Clear all cached data (includes streaming links as of v6)
- `getDatabaseInfo()`: Get cache statistics
- `upgradeDatabase()`: Handle schema migrations

## Troubleshooting

### Common Issues

**Albums not displaying immediately**
- Check if `setSelectedAlbumLoading(false)` is called when cached data is found
- Verify cover URLs are stored in IndexedDB, not added during retrieval

**Cover art missing from main grid**
- Ensure cover URLs are added before `storeCollection()` call
- Check that cached data includes `cover` property

**Cache not refreshing**
- Verify `lastUpdated` timestamp is being set correctly
- Check background refresh logic in `refreshDataInBackground()`

### Debug Tools

Enable console logging to track cache operations:

```typescript
console.log('🗃️ Found cached album data for', albumId);
console.log('🌐 Fetching fresh data from API');
console.log('💾 Stored detailed album information in IndexedDB');
```

### Cache Inspection

Use browser dev tools to inspect IndexedDB:
1. Open DevTools → Application tab
2. Navigate to IndexedDB → MusicLibraryDB
3. Check COLLECTION_STORE and ALBUM_STORE contents

## Performance Considerations

### Memory Management

- IndexedDB handles large datasets efficiently
- Memory fallback limited to current session
- Garbage collection of unused cached data

### Network Optimization

- Background refreshes don't block UI
- Batch API requests where possible
- Use ETags for conditional requests (future enhancement)

## Future Enhancements

### Planned Improvements

1. **Differential sync**: Only fetch changes since last update
2. **Predictive caching**: Preload likely-to-be-viewed albums
3. **Service worker integration**: Complete offline functionality
4. **Cache compression**: Reduce storage usage for large collections

### Migration Strategy

When upgrading database schema:
1. Increment `DB_VERSION` constant
2. Add migration logic in `upgradeDatabase()`
3. Handle data transformation between versions
4. Test with various cache states