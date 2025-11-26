# API Documentation

This document describes the custom API routes provided by the Music Library Viewer application for handling external API integrations, image optimization, and data processing.

## Overview

The application provides several API routes that act as proxies and processors for external services while implementing rate limiting, caching, and optimization features.

## API Routes

### Health Check API

**Endpoint:** `/api/health`
**Method:** GET
**Purpose:** Monitoring endpoint for API availability and deployment health checks

#### Parameters

None

#### Example Usage

```
GET /api/health
```

#### Response

Returns JSON object with service status information:

```json
{
  "status": "ok",
  "timestamp": "2025-11-18T10:30:00.000Z",
  "service": "MusicBrainz GUI API"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always "ok" when service is available |
| `timestamp` | string | ISO 8601 formatted current server time |
| `service` | string | Service identifier |

#### HTTP Status Codes

- `200 OK`: Service is healthy and available

#### Use Cases

- **Monitoring**: Automated health checks by monitoring systems (Pingdom, Uptime Robot, etc.)
- **Deployment**: Verification that deployment completed successfully
- **Load Balancers**: Health check endpoint for traffic routing decisions

### Image Optimization API

**Endpoint:** `/api/image`
**Method:** GET
**Purpose:** Optimizes and caches images with WebP conversion and resizing

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | - | Source image URL (absolute or relative) |
| `w` | number | No | 180 | Target width in pixels |
| `h` | number | No | 180 | Target height in pixels |
| `q` | number | No | 80 | WebP quality (1-100) |

#### Example Usage

```
GET /api/image?url=https://example.com/image.jpg&w=360&h=360&q=85
```

#### Features

- **Format Conversion**: Converts all images to WebP format for optimal file size
- **Resizing**: Resizes images to specified dimensions with cover fit
- **Disk Caching**: Caches optimized images using MD5 hash of parameters
- **Relative URL Handling**: Converts relative URLs to absolute URLs
- **Error Handling**: Graceful fallback for failed image fetches

#### Error Handling & Logging (v0.14.4)

The image API implements **tiered logging** to reduce console noise:

| Error Type | Log Level | Icon | Description |
|------------|-----------|------|-------------|
| 404 Not Found | INFO | ℹ️ | Expected for albums without cover art |
| Network Timeout | WARNING | ⚠️ | Transient CoverArt Archive connectivity issues |
| Other HTTP Errors | WARNING | ⚠️ | Unexpected HTTP status codes |
| Processing Errors | ERROR | ❌ | Genuine image processing failures |

**Network Error Detection:**
- `ETIMEDOUT`: Connection timeout
- `EHOSTUNREACH`: IPv6 route unreachable
- `ECONNREFUSED`: Connection refused

**Rationale:** 404s and timeouts are normal/expected conditions that don't indicate application errors. Using appropriate log levels improves developer experience and makes genuine errors more visible.

#### Response

- **Success**: Returns optimized WebP image with caching headers
- **Error**: JSON error response with appropriate HTTP status code

#### Cache Headers

```
Cache-Control: public, max-age=31536000, immutable
Content-Type: image/webp
```

### MusicBrainz API Proxy

**Endpoint:** `/api/musicbrainz`
**Methods:** GET, POST
**Purpose:** Proxies requests to MusicBrainz API with rate limiting and authentication

#### GET Method
- **Purpose**: Public API requests without authentication
- **Usage**: Forwards all query parameters to MusicBrainz API

#### POST Method
- **Purpose**: Authenticated API requests using HTTP Digest authentication
- **Body Parameters**:
  - `username`: String - MusicBrainz username
  - `password`: String - MusicBrainz password
  - `path`: String - MusicBrainz API path
  - `method`: String - HTTP method (default: GET)

#### Features

- **Rate Limiting**: Enforces MusicBrainz API guidelines (2.1 second minimum between requests)
- **HTTP Digest Authentication**: Secure authentication for private collections
- **User-Agent Management**: Uses configured User-Agent string
- **Error Handling**: Proper error propagation and status codes
- **CORS Support**: Enables cross-origin requests from the frontend
- **Request Queuing**: All requests are queued and processed sequentially to prevent rate limit violations
- **Automatic Retry**: 429 rate limit errors are automatically retried with exponential backoff (up to 3 attempts)
- **Request Deduplication**: Identical requests made within 5 seconds are deduplicated to prevent unnecessary API calls

#### Usage Examples

**Public collection:**
```
GET /api/musicbrainz?path=/collection/12345678-1234-5678-9012-123456789012
```

**Private collection (authenticated):**
```
POST /api/musicbrainz
Content-Type: application/json

{
  "username": "musicbrainz_user",
  "password": "user_password",
  "path": "/collection/private-collection-id",
  "method": "GET"
}
```

### MusicBrainz Authentication Test

**Endpoint:** `/api/musicbrainz/test-auth`
**Method:** POST
**Purpose:** Validates MusicBrainz credentials without storing them

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | MusicBrainz username |
| `password` | string | Yes | MusicBrainz password |

#### Features

- **Credential Validation**: Tests credentials against MusicBrainz API
- **Rate Limiting**: 3 attempts per 15 minutes per IP address
- **Security**: Credentials never stored or logged
- **Quick Response**: Fast validation without complex operations

#### Example Usage

```
POST /api/musicbrainz/test-auth
Content-Type: application/json

{
  "username": "musicbrainz_user",
  "password": "user_password"
}
```

#### Response Format

**Success:**
```json
{
  "valid": true,
  "message": "Credentials are valid"
}
```

**Invalid credentials:**
```json
{
  "valid": false,
  "message": "Invalid credentials"
}
```

**Rate limited:**
```json
{
  "error": "Too many validation attempts. Please try again in 15 minutes.",
  "status": 429
}
```

### Streaming Links API

**Endpoint:** `/api/streaming-links`
**Method:** GET
**Purpose:** Fetches streaming platform links via Odesli API with rate limiting (Phase 2: Caching moved to IndexedDB)

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Music URL to resolve streaming links for |
| `userCountry` | string | No | Country code for region-specific links (default: DE) |

#### Features

- **Rate Limiting**: 6-second minimum interval between requests (10 req/min) - server-side enforcement
- **Caching**: Client-side IndexedDB cache with 1-week TTL (Phase 2 implementation)
- **Platform Support**: Returns links for all major streaming platforms
- **Error Handling**: Graceful handling of API failures
- **Attribution**: Response includes "Powered by Songlink/Odesli" attribution

#### Caching Strategy (Phase 2)

- **Location**: Client-side IndexedDB (STREAMING_LINKS_STORE)
- **TTL**: 1 week (604,800,000 ms)
- **Cache Key**: URL + userCountry
- **Expiration**: Automatic expiration check on cache read
- **Benefits**:
  - Persistent across page reloads and sessions
  - Reduced API calls (better rate limit compliance)
  - Improved user experience with instant loading

#### Example Usage

```
GET /api/streaming-links?url=https://open.spotify.com/album/example&userCountry=US
```

#### Response Format

```json
{
  "linksByPlatform": {
    "spotify": {
      "url": "https://open.spotify.com/album/...",
      "nativeAppUriMobile": "spotify://album/...",
      "nativeAppUriDesktop": "spotify://album/..."
    },
    "appleMusic": {
      "url": "https://music.apple.com/album/..."
    }
  },
  "entitiesByUniqueId": {
    "SPOTIFY_ALBUM::...": {
      "id": "...",
      "type": "album",
      "title": "Album Title",
      "artistName": "Artist Name",
      "thumbnailUrl": "https://..."
    }
  }
}
```

#### Response Headers

```
Cache-Control: public, max-age=604800
X-Cache-Timestamp: 1234567890
```

### Apple Music Geo Link Resolver

**Endpoint:** `/api/resolve-apple-music`
**Method:** GET
**Purpose:** Resolves Apple Music geo links to final destination URLs

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Apple Music geo URL (e.g., `https://geo.music.apple.com/...`) |

#### Features

- **Redirect Resolution**: Follows redirect chains (up to 5 redirects) using axios.head()
- **Final URL Extraction**: Extracts destination URL from redirect chain
- **Error Handling**: Graceful fallback to original URL on failure
- **Caching**: Returns cached responses with 1-week TTL
- **Desktop App Support**: Enables `music://` protocol conversion on client

#### Example Usage

```
GET /api/resolve-apple-music?url=https://geo.music.apple.com/de/album/_/1793338451
```

#### Response Format

**Success:**
```json
{
  "originalUrl": "https://geo.music.apple.com/de/album/_/1793338451",
  "finalUrl": "https://music.apple.com/de/album/album-name/1793338451",
  "success": true
}
```

**Error (fallback):**
```json
{
  "originalUrl": "https://geo.music.apple.com/de/album/_/1793338451",
  "finalUrl": "https://geo.music.apple.com/de/album/_/1793338451",
  "success": false,
  "error": "Request timeout"
}
```

#### Response Headers

```
Cache-Control: public, max-age=604800
```

#### Client-Side Integration

The resolved URLs are automatically converted to `music://` protocol for Apple Music desktop app:

```typescript
// Resolution happens automatically in StreamingLinksSection component
// geo.music.apple.com URL → resolved URL → music:// protocol

// Example flow:
// 1. Input: https://geo.music.apple.com/de/album/_/1793338451
// 2. API resolves to: https://music.apple.com/de/album/album-name/1793338451
// 3. Client converts to: music://de/album/album-name/1793338451
```

#### Caching Strategy

**Client-Side localStorage Cache:**
- **Cache Key**: `appleMusicGeoCache`
- **TTL**: 7 days (604,800,000 ms)
- **Purpose**: Avoid repeated API calls for same geo URLs
- **Benefits**: Instant resolution on repeat album views

```typescript
interface GeoCacheEntry {
  resolvedUrl: string;
  timestamp: number;
}
```

### Cover Art API Proxy

**Endpoint:** `/api/coverart`
**Method:** GET
**Purpose:** Proxies requests to CoverArt Archive API

#### Features

- **Rate Limiting**: Respects CoverArt Archive rate limits
- **Error Handling**: Handles missing cover art gracefully
- **CORS Support**: Enables frontend access to cover art

### Debug APIs

The application includes several debug endpoints for development and troubleshooting:

#### Debug Collection

**Endpoint:** `/api/debug-collection`
**Purpose:** Provides debug information about collection data loading

#### Debug Compare

**Endpoint:** `/api/debug-compare`
**Purpose:** Compares different data sources and processing methods

## External API Integration

### MusicBrainz API

The application integrates with the MusicBrainz Web Service API:

- **Base URL**: `https://musicbrainz.org/ws/2/`
- **Rate Limits**: 1 request per second (enforced by both client and server)
- **Authentication**: User-Agent string required, HTTP Digest for private collections

#### Client-Side Rate Limiting

The application implements a sophisticated client-side rate limiting system via the `MusicBrainzClient` class:

- **Request Queue**: All MusicBrainz API requests are queued and processed sequentially
- **Rate Limiting**: 2.1 second minimum delay between requests (safer than MusicBrainz's 1 second requirement)
- **Automatic Retry**: Failed requests due to rate limits (429 errors) are automatically retried with exponential backoff
- **Request Deduplication**: Identical requests within 5 seconds are deduplicated
- **Memory Management**: Request cache is automatically cleaned up every 10 seconds

This prevents the 429 rate limit errors that can occur when multiple components make simultaneous API requests.

#### Endpoints Used

- `/collection/{collection-id}` - Collection metadata
- `/collection/{collection-id}/release-groups` - Album data (basic info only, releases limited to 25)
- `/release-group/{id}` - Release group basic information (artist, genres, tags)
- `/release?release-group={id}&limit=100` - **Browse endpoint** for fetching up to 100 releases per album
- `/collection?editor={username}` - User's collections (authenticated)

#### Release Fetching Strategy

**Two-Step Process** (v0.10.1+):

1. **Basic Info Lookup**: `/release-group/{id}?inc=artist-credits+genres+tags+ratings`
   - Fetches album metadata without releases (avoids 25-release limit)
   - Includes genres and tags for filtering
   - **Includes ratings** (v0.14.0+): Community average ratings
     - `+ratings`: Returns aggregate community rating (always available, no auth required)
     - `+user-ratings`: Not currently included (would cause 401 errors for unauthenticated users)

2. **Release Browse**: `/release?release-group={id}&inc=media&limit=100`
   - Uses browse endpoint which respects `limit` parameter
   - Fetches up to 100 releases (vs 25-release limit on lookup endpoint)
   - Includes media information for format detection (Digital Media, CD, Vinyl, etc.)
   - **Critical** for finding Digital Media + Worldwide releases needed for streaming links

**Why Browse Endpoint?**
- Lookup endpoints (e.g., `/release-group/{id}`) limit nested entities to 25 items
- Browse endpoints (e.g., `/release?release-group={id}`) support `limit` parameter up to 100
- Albums with >25 releases were missing Digital Media releases, breaking streaming link discovery
- **Example**: Radiohead's "Pablo Honey" went from 0/25 XW releases → 3/33 XW releases

**Rate Limiting**: 1-second delay enforced between the two requests to respect MusicBrainz's 1 req/sec guideline.

#### Rating Data Integration (v0.14.0+)

The application fetches and displays community average ratings from MusicBrainz for release groups:

**API Response Format:**
```json
{
  "id": "9980ffe5-c5b5-3a83-8c1e-1ec6618f97ca",
  "title": "Album Title",
  "rating": {
    "value": 85,
    "votes-count": 127
  }
}
```

**Data Extraction:**
- `rating.value`: Community average rating (0-100 scale)
- `rating.votes-count`: Number of community ratings
- Ratings stored in `ReleaseGroup.rating` object in IndexedDB `ALBUM_STORE`

**Rating Scale Conversion:**
- **MusicBrainz API**: 0-100 integer
- **Display**: 0-5 stars with 1 decimal precision
- **Conversion**: `stars = rating / 20`
- **Example**: API value 85 → 4.3 stars displayed

**Current Implementation:**
- **Community ratings**: Fully supported (no authentication required)
- **Personal ratings**: Not yet implemented (would require OAuth token forwarding through proxy)

**Caching:**
- Ratings cached in IndexedDB as part of `ReleaseGroup` objects
- 30-day TTL (ratings change infrequently)
- No separate rating store needed
- Single IndexedDB read operation for album + rating data

#### Required Headers

```
User-Agent: AppName/Version (contact@example.com)
```

#### Authentication (Optional)

For private collections and user-specific data:

```
Authorization: Digest username="user", realm="musicbrainz.org",
               nonce="...", uri="/ws/2/collection/...",
               response="...", qop=auth, nc=00000001, cnonce="..."
```

#### HTTP Digest Authentication Implementation

The application implements RFC 2617 HTTP Digest Authentication for secure access to private MusicBrainz collections:

1. **Initial Request**: Unauthenticated request receives 401 with WWW-Authenticate header
2. **Digest Calculation**: Client calculates MD5 hash of credentials and request parameters
3. **Authenticated Request**: Subsequent request includes Authorization header with digest
4. **Server Verification**: MusicBrainz server verifies digest and grants access

#### Security Features

- **No Plaintext**: Passwords never transmitted in plaintext
- **Replay Protection**: Nonce and counter prevent replay attacks
- **Integrity**: MD5 digest ensures request integrity
- **Realm Validation**: Ensures authentication scope is correct

### Odesli API (song.link)

Used for streaming platform link discovery:

- **Base URL**: `https://api.song.link/v1-alpha.1/`
- **Rate Limits**: 10 requests per minute (without API key)
- **Authentication**: Optional API key for higher limits
- **Endpoint**: `/links` - Resolve streaming links

#### Parameters

- `url`: Music URL to resolve
- `userCountry`: Country code for localized results
- `songIfSingle`: Boolean for single track handling

### CoverArt Archive API

For album artwork retrieval:

- **Base URL**: `https://coverartarchive.org/`
- **Rate Limits**: Moderate usage recommended
- **Endpoints**:
  - `/release/{mbid}` - Release cover art
  - `/release-group/{mbid}` - Release group cover art

## Rate Limiting Implementation

### MusicBrainz Rate Limiting

```typescript
const RATE_LIMIT_MS = 1000; // 1 second between requests
let lastRequestTime = 0;

// Enforce rate limiting
const now = Date.now();
const timeSinceLastRequest = now - lastRequestTime;
if (timeSinceLastRequest < RATE_LIMIT_MS) {
  await new Promise(resolve =>
    setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest)
  );
}
lastRequestTime = Date.now();
```

### Odesli Rate Limiting

```typescript
const MIN_REQUEST_INTERVAL = 6000; // 6 seconds (10 req/min)

const enforceRateLimit = () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = now;
  return Promise.resolve();
};
```

## Caching Strategy

### Image Caching

- **Location**: `.image-cache/` directory
- **Format**: WebP files with MD5 hash names
- **Duration**: Permanent (until manual cleanup)
- **Cache Key**: `${url}_${width}x${height}_q${quality}`

### API Response Caching

#### Odesli Streaming Links (Two-Layer Caching)

The streaming links system uses two complementary caching layers for optimal performance:

**Layer 1: URL Discovery Cache (localStorage)**
- **Storage**: Client-side localStorage
- **Cache Key**: Album ID (release group ID)
- **Cache Value**: Successful streaming URL
- **Purpose**: Eliminate MusicBrainz API calls for URL discovery
- **TTL**: Indefinite (cleaned with other localStorage data)

```typescript
// Store album → URL mapping
setCachedStreamingUrl(albumId, successfulUrl);

// Retrieve cached URL for instant lookup
const cachedUrl = getCachedStreamingUrl(albumId);
```

**Layer 2: Platform Links Cache (IndexedDB)**
- **Storage**: Client-side IndexedDB (persistent)
- **Cache Key**: URL + userCountry
- **Cache Store**: STREAMING_LINKS_STORE
- **Duration**: 1 week (604800 seconds)
- **Purpose**: Cache streaming platform links from Odesli API

```typescript
// Store streaming links in IndexedDB
await storeStreamingLinks(url, streamingLinks, userCountry);

// Retrieve from IndexedDB (with automatic expiration check)
const cachedLinks = await getStreamingLinks(url, userCountry);

// Cleanup expired entries
await cleanExpiredStreamingLinks();
```

**Two-Layer Architecture Benefits:**
- **Instant Display**: <100ms for previously-viewed albums
- **API Call Reduction**: 95%+ reduction in both MusicBrainz and Odesli API calls
- **Layer 1 Benefit**: Skips 3+ MusicBrainz API calls (6+ seconds saved)
- **Layer 2 Benefit**: Skips Odesli API lookup (1-2 seconds saved)
- **Persistent**: Survives page reloads, browser restarts, server deployments
- **Graceful Degradation**: Each layer can work independently
- **Memory Fallback**: Falls back to memory cache if IndexedDB unavailable

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error description",
  "status": 400
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Missing required parameters |
| 404 | Not Found - Resource not available |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Processing failed |
| 502 | Bad Gateway - External API error |

### Error Recovery

- **Graceful Degradation**: APIs return appropriate fallbacks
- **Retry Logic**: Automatic retries for transient failures
- **User Feedback**: Clear error messages in UI
- **Logging**: Detailed error logging for debugging

## Security Considerations

### Input Validation

- URL validation for image optimization
- Parameter sanitization for all APIs
- Rate limiting to prevent abuse

### CORS Configuration

```typescript
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
```

### User-Agent Requirements

All external API requests include proper User-Agent identification as required by service terms.

## Performance Optimizations

### Image Processing

- **Sharp Library**: High-performance image processing
- **WebP Format**: Optimal compression and quality
- **Disk Caching**: Eliminates repeated processing
- **Proper Cache Headers**: Browser caching optimization

### API Requests

- **Connection Pooling**: Reuse HTTP connections
- **Response Caching**: Reduce external API calls
- **Rate Limiting**: Respect external service limits
- **Error Caching**: Temporary caching of error responses

## Monitoring and Debugging

### Logging

Development mode provides detailed logging for:
- API request/response cycles
- Rate limiting decisions
- Cache hit/miss statistics
- Error conditions and stack traces

### Debug Endpoints

Use debug endpoints to troubleshoot:
- Collection data loading issues
- API response differences
- Performance bottlenecks
- Cache effectiveness