# Architecture Overview

This document provides a comprehensive technical overview of the Music Library Viewer architecture, data flow, and implementation details.

## Technical Stack

- **Framework:** Next.js 14 with React
- **Language:** TypeScript
- **CSS:** Tailwind CSS
- **State Management:** React Hooks
- **Icon Library:** react-icons (Boxicons collection)
- **Data Source:** MusicBrainz API with dynamic collection configuration
- **Collections:** Public MusicBrainz collection support
- **Configuration:** Browser localStorage with UI-based collection setup
- **Image Optimization:** Next.js Image with custom optimization API

## Directory Structure

```
MusicBrainz_GUI
├── .next/
├── .image-cache/              # Cache for optimized images
├── node_modules/
├── public/
│   ├── placeholder.svg        # Fallback for missing cover art
│   └── placeholder-album.svg  # Original fallback image
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # OAuth2 authentication endpoints
│   │   │   ├── cache/
│   │   │   │   └── stats/     # Cache statistics endpoint
│   │   │   ├── coverart/      # Coverart API proxying
│   │   │   ├── image/         # Custom image optimization API
│   │   │   │   └── route.ts   # Handles image resizing and caching
│   │   │   ├── musicbrainz/   # MusicBrainz API proxying
│   │   │   ├── prefetch/
│   │   │   │   └── start/     # Background prefetch trigger
│   │   │   ├── release-groups/
│   │   │   │   └── [mbid]/    # Cached release group endpoint
│   │   │   ├── resolve-apple-music/ # Apple Music geo link resolution
│   │   │   ├── streaming-links/ # Odesli API proxy with server-side cache
│   │   │   │   └── route.ts   # Handles streaming links fetching
│   │   │   └── health/        # Health check endpoint
│   │   ├── config/
│   │   │   └── page.tsx       # Dynamic configuration UI for collection setup
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx           # Main application page
│   ├── components/
│   │   ├── AlbumCard.tsx      # Individual album display
│   │   ├── AlbumGrid.tsx      # Grid layout for albums
│   │   ├── CoverArtImage.tsx  # Specialized image component for cover art
│   │   ├── ActiveFiltersBar.tsx   # Persistent bar showing active filters with clear-all button
│   │   ├── FilterButton.tsx       # Filter toggle button with active count badge
│   │   ├── FilterPanel.tsx        # Collapsible genre filter panel
│   │   ├── Header.tsx         # App header with search, sort, filter & stats
│   │   ├── SearchBar.tsx      # Search functionality
│   │   ├── AlbumDetailsPanel.tsx  # Album details panel with horizontal layout
│   │   ├── StreamingLinksSection.tsx # Streaming platform links with icons
│   │   ├── StarRating.tsx     # 5-star rating display component with fractional rendering
│   │   ├── RatingFilterSection.tsx # Rating range filter with double slider
│   │   └── TrackList.tsx      # Track listing component with duration formatting and release information display
│   ├── hooks/
│   │   ├── useAlbums.ts       # Album data fetching & management
│   │   ├── useAuth.ts         # OAuth2 authentication state
│   │   ├── useFilters.ts      # Filter state management with persistence
│   │   └── usePreferences.ts  # Centralized user preference management
│   ├── lib/
│   │   ├── cache/
│   │   │   ├── base-cache.ts         # Abstract cache with disk persistence
│   │   │   ├── cache-manager.ts      # Coordinator + auto-save
│   │   │   ├── release-group-cache.ts # RG cache with MBID refs
│   │   │   ├── release-store.ts      # Shared release storage
│   │   │   └── streaming-links-cache.ts # Odesli response cache (7-day TTL)
│   │   ├── prefetch/
│   │   │   ├── prefetch-queue.ts     # Priority queue system
│   │   │   └── prefetch-service.ts   # Background prefetch orchestration
│   │   ├── odesli-rate-limiter.ts    # Odesli API 6s rate limiting
│   │   ├── rate-limiter.ts           # MusicBrainz API 2s rate limiting
│   │   └── types/
│   │       └── cache.ts              # Cache-specific interfaces
│   ├── types/
│   │   ├── auth.ts            # Authentication type definitions
│   │   ├── music.ts           # Music-related TypeScript interfaces
│   │   └── preferences.ts     # User preference type definitions
│   └── utils/
│       ├── config/
│       │   └── userAgent.ts    # Centralized User-Agent configuration
│       ├── genre-processor.ts       # Genre extraction, counting, and filtering utilities
│       ├── label-processor.ts       # Label extraction with duplicate removal, counting, and filtering utilities
│       ├── normalize-mb-data.ts     # Data normalization utilities
│       ├── streaming-links.ts       # Enhanced multi-URL streaming platform integration with Odesli API
│       ├── preference-migration.ts  # Legacy preference migration utilities
│       └── ratings.ts               # Rating conversion utilities and display logic (0-100 ↔ 0-5 stars)
├── .env.local
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js         # Theme & styling configuration
└── tsconfig.json
```

## Responsive Design System

### CSS Variables (src/app/globals.css)

The application uses CSS custom properties for dynamic, responsive layouts:

**Header Height Variables:**
- Desktop: `--header-height: 64px`
- Mobile: `--header-height: 56px` (below 768px)
  - Reduced from 96px to accommodate compact single-row mobile header
  - Mobile header uses hamburger menu to hide collection name and settings

**Dynamic Filter Bar Height:**
- `--active-filters-height`: Dynamically calculated via ResizeObserver
  - Updates in real-time as filter chips wrap to multiple rows
  - Used by FilterPanel and AlbumDetailsPanel for proper positioning
  - Prevents overlap when many filters are active on mobile

**Responsive Grid Columns (tailwind.config.js):**
- Mobile (`album-grid`): `repeat(auto-fill, minmax(115px, 1fr))` - 3 cards per row
- Tablet (`album-grid-tablet`): `repeat(auto-fill, minmax(140px, 1fr))`
- Desktop (`album-grid-desktop`): `repeat(auto-fill, minmax(180px, 1fr))`

## Data Architecture

### User Preference Management

The application features a centralized preference management system designed for scalability and type safety:

```
User Preferences Architecture
    ↓
usePreferences Hook (Single Source of Truth)
    ├─ Display Preferences (sort, genres, theme)
    ├─ Streaming Preferences (enabled services, Spotify desktop)
    ├─ API Configuration (collection ID, caching, etc.)
    └─ Collection Metadata (name, timestamps)
    ↓
Automatic Migration from Legacy Keys
    ├─ mbConfigOptions → api preferences
    ├─ sortOption → display.sortOption
    ├─ useGenresOnly → display.useGenresOnly
    ├─ spotifyUseDesktopApp → streaming.spotifyUseDesktopApp
    └─ collectionName → metadata.collectionName
    ↓
Single localStorage Key (mb-user-preferences)
    └─ Versioned schema for future migrations
```

#### Preference Categories

- **Display**: Sort options, genre display control, theme settings
- **Streaming**: Individual service toggles, Spotify desktop app preference
- **API**: Collection configuration, caching options, debugging settings
- **Metadata**: Collection name, sync timestamps, user-specific data

#### Migration Strategy

- **Automatic**: Legacy keys converted on first load
- **Safe**: Old keys preserved during transition period
- **Versioned**: Schema versioning for future migrations
- **Type-Safe**: Full TypeScript validation

### Collection Loading Architecture (v0.14.4)

The application uses a **direct prop-passing pattern** for collection switching to enable automatic reloading without page refresh:

```
Collection Switch Flow (v0.14.4)
    ↓
User selects collection in Browse Collections panel
    ↓
handleLoadCollection(newId, name)
    ├─ updateApi({ collectionId: newId })      // Persist to localStorage
    ├─ updateMetadata({ collectionName })      // Persist collection name
    └─ setActiveCollectionId(newId)            // Update local state
    ↓
activeCollectionId state change detected
    ↓
useAlbums(activeCollectionId) receives new prop
    ↓
useEffect dependency triggers
    ↓
fetchAlbums() runs with new collection ID
    ↓
Albums reload automatically (no page refresh needed)
```

#### Key Implementation Details

**useAlbums Hook Enhancement:**
- Accepts optional `externalCollectionId?: string` parameter
- Uses `externalCollectionId ?? preferences.api.collectionId` pattern
- useEffect depends on `[fetchAlbums, externalCollectionId]`

**Page-Level State Management:**
- Local `activeCollectionId` state initialized from preferences
- Updated via `setActiveCollectionId()` in `handleLoadCollection`
- Passed to `useAlbums(activeCollectionId)` for prop-driven reload

**Benefits Over Event-Based Approaches:**
- ✅ No infinite loops from multi-instance hook synchronization
- ✅ No custom events or cross-component coordination
- ✅ Pure React data flow (single direction: parent → child)
- ✅ Standard React patterns (props + useEffect dependencies)
- ✅ Easy to understand and maintain

**Related Report:** See `REPORT_COLLECTION_LOADING.md` for detailed history of implementation attempts and lessons learned.

### Primary Data Source: MusicBrainz API

- **Collection Endpoint**: `/ws/2/collection/{collection-id}` for collection metadata
- **Release Groups**: `/ws/2/collection/{collection-id}/release-groups` for album data
- **Series Endpoint**: `/ws/2/series/{series-id}?inc=release-group-rels` for series data
- **Individual Albums**: Two-step fetch process to get up to 100 releases per album

#### Series Support (v0.33.0)

Series are official MusicBrainz lists (e.g., "Rolling Stone 500 Greatest Albums") with ordered rankings.

**Key Differences from Collections:**
- **Endpoint**: `/series/{id}?inc=release-group-rels` (vs `/collection/{id}`)
- **Metadata**: Limited initial data (no genres/tags/ratings from series API)
- **Ordering**: Includes `seriesOrder` field for rankings
- **Enhancement**: Background fetch via `/api/enhance-metadata` enriches metadata

**Entity Type Detection:**
```typescript
import { validateEntityId } from '@/utils/mbid-validation';
const { entityType } = await validateEntityId(input); // 'collection' | 'series'
```

**Files:**
- `src/utils/release-groups-helper.ts` - `fetchAllReleaseGroupsInSeries()`
- `src/utils/mbid-validation.ts` - Entity type detection
- `src/app/api/enhance-metadata/route.ts` - Background enrichment

#### Release Group Fetching Architecture

**Problem**: MusicBrainz API lookup endpoints (e.g., `/release-group/{id}`) limit nested entities to 25 items, regardless of the `limit` parameter. This means albums with many releases (>25) would only return the first 25, often missing Digital Media + Worldwide releases needed for streaming links.

**Solution**: Two-step fetch using both lookup and browse endpoints:

**Step 1: Fetch Basic Release Group Info**
```
GET /release-group/{id}?inc=artist-credits+genres+tags
```
- Returns album metadata (title, artist, genres, tags)
- Does NOT include `+releases` (which would be limited to 25)

**Step 2: Fetch Up To 100 Releases via Browse Endpoint**
```
GET /release?release-group={id}&inc=media&limit=100
```
- Uses browse endpoint which supports `limit` parameter up to 100
- Includes `+media` to detect Digital Media format
- Returns up to 100 releases sorted chronologically

**Rate Limiting**: 1-second delay between the two requests to respect MusicBrainz's 1 req/sec limit.

#### Why Browse Endpoint is Critical

The application uses `selectPreferredRelease()` to choose the best release:
1. **Priority 1**: Digital Media format + Worldwide (XW) country code
2. **Priority 2**: Fallback to first release

**Without browse endpoint** (using only lookup with 25-release limit):
- Albums with >25 releases miss newer Digital Media releases
- Streaming URL discovery often fails (older releases lack streaming platforms)
- Example: "Pablo Honey" by Radiohead went from 0/25 XW releases → 3/33 XW releases

**With browse endpoint** (limit=100):
- Access to 4x more releases per album
- Higher chance of finding Digital Media + XW releases with streaming URLs
- Significant improvement in streaming link success rate

**Reference**: This architectural change was implemented in v0.10.1 to fix the 25-release limitation. See CHANGELOG.md for details.

### Data Flow

The application follows a progressive loading pattern with IndexedDB-first caching:

```
User Opens App
    ↓
useAlbums hook
    ↓
Progressive Loader (client-side)
    ↓
Check IndexedDB (browser storage)
    ├─ If cached & fresh → Return immediately
    │   ├─ Load collection name from metadata
    │   │   └─ Update preferences + dispatch event → Header updates
    │   └─ (+ background refresh if >30min old)
    └─ If no cache → Fetch from API
        ↓
        /api/musicbrainz proxy (collection metadata)
        ↓
        MusicBrainz External API
        ├─ Collection name (immediate callback)
        │   └─ Update preferences + dispatch event → Header updates
        └─ Paginated album data
        ↓
        Store in IndexedDB (with collection name in metadata)
    ↓
Apply filters (genres/labels)
    ↓
Display filtered results
```

1. **Immediate Cache Display**: Basic album data shows instantly from IndexedDB cache
2. **Collection Name Handling**:
   - From cache: Loaded from `CollectionMetadata.name` field (instant)
   - From API: Early callback after metadata fetch (immediate, before albums load)
   - Migration: Falls back to API fetch if name missing from old cache
3. **Background Refresh**: Cache updated in background if older than 30 minutes
4. **Progressive Details**: Full album details fetched on-demand when user opens details panel
5. **Cache-First Loading**: Album details check cache before setting loading states to prevent skeleton flash
6. **Memory Fallback**: Session-level fallback if IndexedDB fails

## Genre/Tag Filtering Architecture

The application distinguishes between official MusicBrainz genres and user-submitted tags:

### Data Structure
- `album.genres[]` - Official genre tags from MusicBrainz
- `album.tags[]` - All user-submitted tags

### Control Flow
- `useAlbums` hook maintains `useGenresOnly` state (default: `true`)
- User can toggle via Settings page (`/config`)
- Setting persisted to localStorage

### Data Flow
```
useAlbums (source of truth)
├── → page.tsx (receives useGenresOnly)
│   ├── → useFilters(albums, useGenresOnly)
│   ├── → AlbumDetailsPanel (useGenresOnly prop)
│   └── → albumMatchesGenreFilters(..., useGenresOnly)
└── → config page (can modify via setUseGenresOnly)
```

### Component Defaults
- Utility functions and components have `useGenresOnly = true` defaults
- These are safety fallbacks, not overrides
- Always overridden by explicit values from useAlbums

## IndexedDB Architecture

The application uses a sophisticated IndexedDB caching system with separated data stores for optimal performance and data organization.

### Database Schema (Version 6)

```typescript
// Collection metadata store
interface CollectionMetadata {
  id: string;           // Collection ID (primary key)
  name?: string;        // Collection name from MusicBrainz API
  albumIds: string[];   // Array of album MBIDs in this collection
  lastUpdated: Date | null;
  itemCount: number;
  isComplete: boolean;
}

// Album data store
interface ReleaseGroup {
  id: string;           // Album MBID (primary key)
  title: string;
  artist_credit: ArtistCredit[];
  first_release_date: string;
  cover: string;        // Cover art URL
  // ... other album properties
}
```

### Store Separation Strategy

**COLLECTION_STORE**:
- Tracks which albums belong to which collections
- Stores collection metadata (name, sync status, timestamps)
- Enables multiple collection support with proper name association
- Primary key: `collectionId`

**ALBUM_STORE**:
- Stores complete album information
- Shared across all collections (deduplicated)
- Supports both basic and detailed album data
- Primary key: `albumId` (MBID)

### Caching Flow

1. **Initial Load**:
   - Check `COLLECTION_STORE` for collection metadata
   - If complete & fresh: Load albums from `ALBUM_STORE` by IDs
   - If missing/stale: Fetch from API, store in both stores

2. **Cover Art Integration**:
   - Cover URLs added BEFORE storing in IndexedDB
   - Format: `/api/coverart/release-group/{id}/front`
   - Ensures cover art persists across cache retrievals

3. **Album Details**:
   - Basic data shows immediately from `ALBUM_STORE`
   - Detailed info fetched in background if not cached
   - Updates existing record with detailed data

4. **Cache Freshness**:
   - 30-minute freshness threshold
   - Background refresh without UI blocking
   - Dispatches `mb-data-updated` event on completion

### Progressive Loader Implementation

The `ProgressiveLoader` class manages the caching strategy:

```typescript
// Direct API call (bypasses collection-handler caching issues)
const releaseGroups = await fetchAllReleaseGroupsInCollection(this.collectionId, userAgent);

// Add cover URLs BEFORE storing
const apiData = releaseGroups.map(rg => ({
  ...rg,
  cover: `/api/coverart/release-group/${rg.id}/front`
}));

// Store in separated schema
await db.storeCollection(apiData, this.collectionId);
```

### Data Types

- **ReleaseGroup**: Core album information (title, artist, date, type, MBID, genres, tags)
  - **genres**: Array of official MusicBrainz genre names or objects - supports both `string[]` (legacy) and `Genre[]` (new) formats
  - **tags**: Array of all user-submitted tag names or objects - supports both `string[]` (legacy) and `Tag[]` (new) formats
- **Genre**: Individual genre with popularity data (`name: string, count: number`)
- **Tag**: Individual tag with popularity data (`name: string, count: number`)
- **Collection**: Collection metadata (name, description, owner info)
- **CacheStatus**: Tracking data freshness and sync status

### Album Details Loading Strategy

The album details loading system has been optimized to prevent unnecessary skeleton loading indicators:

**Cache-First Approach (v0.8.2):**
```typescript
// Check cache availability BEFORE setting loading state
const cachedAlbum = await getReleaseGroup(albumId);
if (cachedAlbum) {
  // Show cached data immediately - no loading state
  setSelectedAlbumDetails(cachedAlbum);
  shouldShowLoading = false;
} else {
  // Only show loading indicator when actually fetching from network
  setSelectedAlbumLoading(true);
}
```

**Progressive Component Loading:**
- **Main Panel**: Shows cached data immediately without skeleton flash
- **TrackList Component**: Independent loading state for missing tracklist data
- **StreamingLinks Component**: Independent loading state for streaming platform links (with IndexedDB caching)
- **Background Updates**: API calls update data without triggering loading indicators

This approach ensures optimal user experience by eliminating unnecessary loading states while preserving progressive loading for genuinely missing data.

### Streaming Links Data Flow (Two-Layer Caching)

The streaming links feature uses a two-layer caching system for instant display on repeat views:

```
Album Details Opened
    ↓
fetchReleaseGroup() → Returns IMMEDIATELY with tracklist
    │                 (streamingLinks: undefined)
    ↓
Tracklist Displays ✅ (no blocking)
    ║
    ║ (parallel)
    ↓
AlbumDetailsPanel useEffect triggers
    ↓
fetchStreamingLinksForAlbum(albumId)
    ↓
LAYER 1: Check localStorage for album → URL mapping
    ├─ If found → getCachedStreamingUrl(albumId) returns URL
    │   ↓
    │   LAYER 2: Check STREAMING_LINKS_STORE (IndexedDB) for that URL
    │   ├─ If cached & fresh (<1 week) → Display INSTANTLY ⚡ (<100ms)
    │   │
    │   └─ If no cache → Fetch from Odesli API (fallback)
    │
    └─ If no mapping → Full discovery process
        ↓
        Search through releases for streaming URLs
        (3+ MusicBrainz API calls, 2-second delays)
        ↓
        Test URLs with Odesli API
        ↓
        Store successful URL in localStorage (Layer 1)
        Store streaming links in IndexedDB (Layer 2)
        ↓
        Display streaming links
```

**Two-Layer Caching Benefits:**
- **Instant Display**: Cached albums load streaming links in <100ms (no API calls)
- **Layer 1 (localStorage)**: Album → URL mapping eliminates MusicBrainz API discovery
- **Layer 2 (IndexedDB)**: URL → Platform links with 1-week TTL
- **95%+ API Reduction**: Combination of both layers minimizes all external API calls
- **Non-Blocking**: Tracklist displays immediately, streaming links load in background
- **Persistent**: Survives page reloads, browser restarts, server deployments
- **Graceful Fallback**: Falls through to full discovery if either cache layer misses

### Rating System Architecture

The application features a view-only 5-star rating system displaying community average ratings from MusicBrainz.

**Data Structure:**
```typescript
interface Rating {
  average: number | null;     // 0-100 scale (MusicBrainz format)
  count: number;              // Number of community ratings
  personal: number | null;    // Reserved for future personal ratings (currently always null)
  fetchedAt: number;          // Timestamp for cache management
  requiresAuth: boolean;      // Whether personal rating needs authentication
}

// Embedded in ReleaseGroup
interface ReleaseGroup {
  // ... existing fields
  rating?: Rating;
}
```

**Current Implementation:**
- **Community Average Ratings**: Displays aggregate ratings from all MusicBrainz users (no auth required)
- **Personal Ratings**: UI prepared but not yet implemented (requires OAuth token forwarding through proxy)

**API Integration:**
```
GET /release-group/{id}?inc=artist-credits+genres+tags+ratings
```
- `+ratings`: Returns aggregate community rating (always available)
- `+user-ratings`: Not currently included (would require per-request OAuth authentication)

**Rating Scale Conversion:**
- **MusicBrainz API**: 0-100 integer scale
- **Display**: 0-5 stars with 1 decimal precision
- **Conversion**: `stars = rating / 20` (e.g., 85 → 4.3 stars)

**Caching Strategy:**
- Ratings embedded in `ReleaseGroup` objects in `ALBUM_STORE`
- 30-day TTL (ratings change infrequently)
- Single IndexedDB read operation (album + rating together)
- No separate rating store needed

**Filtering:**
- Filter by rating range (0-5 stars, step: 0.5)
- Always uses average rating for filtering (not personal)
- Albums without ratings excluded when filter is active
- Amber/yellow color theme in UI (matches star color)

**User Experience:**
- StarRating component displays fractional stars (e.g., 3.7 stars)
- Vote count shown for community ratings (e.g., "4.2 (127 ratings)")
- Personal rating mode available in settings but shows "Not yet implemented" message
- Rating filter in FilterPanel with double range slider (amber star icon)
- Active rating filters shown in ActiveFiltersBar with amber chip

**Preference Management:**
```typescript
interface DisplayPreferences {
  // ... existing fields
  showRatings: boolean;              // Master toggle (default: true)
  ratingDisplayMode: 'average' | 'personal';  // Display mode (personal not yet functional)
}
```

**Future Enhancement:**
Personal ratings can be implemented by enhancing the MusicBrainz proxy to forward OAuth Bearer tokens and including `+user-ratings` in API calls.

### Data Sources

- **IndexedDB Cache**: Primary cache for offline functionality
- **Memory Cache**: Secondary cache for session persistence

## Server-Side Cache Architecture

The application implements a sophisticated three-layer server-side caching system for release groups, releases, and streaming links. Added in v0.23.0-v0.31.0.

### Cache Infrastructure

**Base Cache (`lib/cache/base-cache.ts`)**:
- Abstract cache class with disk persistence
- Automatic save every 5 minutes
- Graceful shutdown handlers (SIGTERM, SIGINT)
- TTL-based expiration
- Prevents cache loss on server restart

**Release Store (`lib/cache/release-store.ts`)**:
- Shared storage for individual releases
- Reverse index: release MBID → parent release group MBIDs
- Deduplicates releases across multiple RGs
- 30-day TTL

**Release Group Cache (`lib/cache/release-group-cache.ts`)**:
- Stores RG metadata + references to releases (not full release data)
- Uses shared release store for hydration
- 30-day TTL
- Includes embedded streaming links

**Streaming Links Cache (`lib/cache/streaming-links-cache.ts`)**:
- Caches Odesli API responses
- Keyed by: streaming URL + user country code
- 7-day TTL
- Reduces Odesli API calls across all users

**Cache Manager (`lib/cache/cache-manager.ts`)**:
- Coordinates all caches
- Handles persistence to `.cache/` directory
- Auto-save every 5 minutes
- Graceful shutdown save

### Singleton Pattern

All cache instances use `globalThis` to persist across Next.js module re-evaluations:

```typescript
if (!globalThis.releaseGroupCache) {
  globalThis.releaseGroupCache = new ReleaseGroupCache();
}
export const releaseGroupCache = globalThis.releaseGroupCache;
```

This prevents cache resets during development and hot module replacement.

### Prefetch System

**Priority Queue (`lib/prefetch/prefetch-queue.ts`)**:
- Two-tier queue: high priority (user clicks), low priority (background)
- Automatic deduplication
- FIFO ordering within each tier

**Prefetch Service (`lib/prefetch/prefetch-service.ts`)**:
- Background fetching of release group details + streaming links
- Triggered automatically when collection loads
- Filters already-cached items
- Respects rate limiting (2s MusicBrainz, 6s Odesli)
- Progress logging every 60 seconds
- Retry logic with exponential backoff (1s → 2s → 4s) for network errors

### Rate Limiting

**MusicBrainz Rate Limiter (`lib/rate-limiter.ts`)**:
- Shared 2-second delay for all MusicBrainz API calls
- Used by: collection fetches, release group fetches, release detail fetches

**Odesli Rate Limiter (`lib/odesli-rate-limiter.ts`)**:
- Separate 6-second delay for Odesli API calls
- Server-side enforcement only (client makes no additional delays)
- Used by: streaming links fetches, prefetch service

### Cache Workflow

```
User Opens Album Details
    ↓
Check Release Group Cache
    ├─ If cached → Return instantly (~50ms)
    │   └─ Includes: metadata + releases + streaming links
    └─ If not cached → Fetch from MusicBrainz API (~10-15s)
        ↓
        Store in Release Group Cache + Release Store
        ↓
        Fetch streaming links (if not cached)
        ↓
        Store in Streaming Links Cache
        ↓
        Return to client
```

### API Endpoints

**`/api/release-groups/[mbid]` (v0.24.0)**:
- Cached endpoint for release group details
- Returns full RG with hydrated releases
- ~50ms for cached, ~10-15s for uncached

**`/api/cache/stats` (v0.28.0)**:
- Real-time cache statistics
- Hit rates, memory usage, item counts
- Prefetch progress monitoring

**`/api/prefetch/start` (v0.26.0)**:
- Triggers background prefetch
- Returns immediately (non-blocking)
- Used by `useAlbums` hook on collection load

### Benefits

- **Instant Loading**: Cached release groups load in ~50ms vs 10-15s
- **Reduced API Calls**: 95%+ reduction for repeat views
- **Multi-User Efficiency**: Server cache shared across all users
- **Persistent**: Survives server restarts with auto-save
- **Smart Prefetch**: Background loading of likely-to-be-viewed albums

## Performance Optimization

### Image Optimization

The application includes several image optimization features:

1. **Custom Image API** (`/api/image`):
   - Resizes images to the appropriate display size
   - Converts images to WebP format for smaller file sizes
   - Caches optimized images to improve loading times

2. **Progressive Loading**:
   - Shows color-based placeholders during image loading
   - Smooth transition from placeholder to actual image
   - Fallback handling for missing or invalid images

3. **Performance Monitoring**:
   - Tracks image loading times in development mode
   - Provides console reports on image optimization effectiveness
   - Helps identify problematic images

### Lazy Loading Implementation

- ✅ Implemented IntersectionObserver-based lazy loading for album grid
- ✅ Created specialized LazyAlbumCard component to defer rendering until needed
- ✅ Added performance monitoring to track DOM size and memory consumption
- ✅ Prioritized loading for selected albums and surrounding items
- ✅ Used standard placeholders for consistent visual appearance

## MusicBrainz Data Loading Optimization Strategy

The current implementation reloads all album items from MusicBrainz API on each application refresh, which is inefficient and risks hitting rate limits. Following industry best practices from professional music applications like Spotify, Tidal, and Apple Music, we've developed a tiered optimization strategy:

### Short-Term Strategy (Immediate Implementation)

1. **Client-Side Caching with IndexedDB**
   - Store complete MusicBrainz responses in browser's IndexedDB
   - Display cached data immediately on app startup
   - Add a background refresh mechanism that updates cache without blocking UI
   - Include cache status indicators (last updated time, sync status)

2. **Progressive Loading Pattern**
   - Load essential metadata first (title, artist, ID) to show basic grid
   - Defer full metadata loading until needed
   - Prioritize loading content in the current viewport
   - Implement skeleton placeholders during data loading

### Medium-Term Strategy (Next Development Phase)

1. **Enhanced Server-Side API Proxy**
   - Upgrade the existing MusicBrainz API proxy endpoints
   - Implement server-side caching with proper invalidation
   - Add ETag and If-None-Match support to minimize data transfer
   - Use stale-while-revalidate pattern for optimal performance

2. **Rate Limit-Aware Request Manager**
   - Create a centralized request manager for all MusicBrainz API calls
   - Implement request queuing with controlled concurrency
   - Add intelligent backoff for rate limit handling
   - Provide priority queue for critical requests

3. **Data Normalization Layer**
   - Structure data in a normalized, relational-like format
   - Reference entities by ID rather than duplicating data
   - Add entity-specific caching strategies

### Long-Term Strategy (Future Enhancements)

1. **Differential Sync Engine**
   - Only fetch changes since last sync rather than full collection
   - Implement a proper sync protocol with MusicBrainz
   - Track local modifications for eventual consistency
   - Support conflict resolution for simultaneous changes

2. **Offline-First Architecture**
   - Implement Service Workers for complete offline functionality
   - Add background sync capabilities
   - Provide offline editing with eventual server consistency
   - Use IndexedDB as primary data source with server as secondary

3. **Advanced Prefetching**
   - Analyze user behavior to predict next albums to view
   - Preload likely-to-be-accessed content during idle time
   - Implement resource hints (preconnect, prefetch) for external resources
   - Optimize initial page load with critical path rendering

### Implementation Notes

- All implementations must respect MusicBrainz rate limits and developer guidelines
- Add appropriate user interface elements to indicate sync/cache status
- Maintain graceful degradation when offline or when API is unavailable
- Consider memory usage implications for very large collections

## UI/Theme Configuration

### Color Scheme: Dark theme
- **Background:** #121212 (primary), #1A1A1A (secondary), #2A2A2A (tertiary)
- **Primary accent:** #8B5CF6 (violet-500)
- **Text:** White (primary), #B3B3B3 (secondary), #727272 (tertiary)

### Layout
- **Grid Layout:** Auto-fill with minimum width of 180px per card
- **Spacing:** Minimal gap (gap-1) between album cards
- **Border Lines:** 1px borders with explicit height (64px) for headers

### Authentication UI (v0.12.3+)

**Location**: Header menu dropdown (accessible via hamburger icon)

**Authentication States:**

- **Not Authenticated**:
  - Shows BiUserX icon (white/70 opacity)
  - "Login with MusicBrainz.org" text with BiLinkExternal indicator
  - Redirects to OAuth flow when clicked
- **Authenticated**:
  - Shows BiUserCheck icon (primary violet color)
  - "Logged in as USERNAME" with clickable username link
  - Username links to MusicBrainz profile (opens in new tab with BiLinkExternal indicator)
  - Logout button with BiLogOut icon on same row
  - Auto-detects auth state via `useAuth` hook

**User Flow:**

1. User clicks hamburger menu icon in header
2. Menu dropdown shows authentication section
3. Login/logout actions executed directly from menu
4. Toast notification appears in top-right corner with success/error message
5. Menu auto-closes after action
6. User remains on current page (no navigation to config page)

**Toast Notifications:**

- **Success (Login)**: "Successfully logged in as USERNAME!" - Green background, 3-second display
- **Success (Logout)**: "Successfully logged out!" - Green background, 3-second display
- **Error**: "Login failed: {error}" - Red background, 5-second display
- Position: Fixed top-right corner (z-50)
- Animation: Smooth fade-in with slide-down effect
- Auto-dismiss with configurable timing

**Benefits:**

- Always accessible from any page
- No navigation to settings required
- Visual feedback via toast notifications
- Username clickable to view MusicBrainz profile
- Cleaner settings page (auth removed from config)
- Non-disruptive notifications (top-right corner)

## State Management

### React Hooks Architecture

The application uses a centralized state management approach:

- **useAlbums**: Central hook for album data, filtering, and collection management
  - **Single Source of Truth for `useGenresOnly`**: Controls genre vs tag display globally
  - Default: `true` (official genres only)
  - Persisted to localStorage
  - Passed down to all components and utilities
- **useFilters**: Dedicated hook for filter state management with localStorage persistence
  - Receives `useGenresOnly` from parent component
  - Uses it to determine which data to filter (genres vs tags)
- **Local State**: Component-level state for UI interactions (panel open/close, loading states)

### Data Persistence

- **localStorage**: User preferences, filter selections, sort preferences, configuration
- **IndexedDB**:
  - `COLLECTION_STORE`: Collection metadata and album membership
  - `ALBUM_STORE`: Complete album data (shared across collections)
  - Database version 5 with separated schema design
- **Memory**: Session-level fallback for IndexedDB failures

## Known Challenges

- Manual data cleaning needed for MusicBrainz data
- API rate limits when fetching from MusicBrainz
- Large collection performance considerations (10,000+ items)
- Complex release structures with multiple formats and editions

## Future Roadmap

### Features
- Review integration from music websites
- Artist grouping functionality
- Detailed view for albums/stations
- Automated MusicBrainz data updates

### Optimizations
- Optimize search performance for large collections
- Consider implementing virtualized scrolling for extremely large libraries
- Enhanced caching strategies
- Better error handling and offline support