# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.22.0] - 2025-11-28

### Changed

- **Refresh Button Relocation**: Moved refresh button to contextual locations in Browse Collection panel
  - Appears next to "Current" badge on active collection card
  - Appears next to manual input when manual collection is loaded

## [0.21.0] - 2025-11-28

### Added

- **Manual Collection Refresh**: Refresh button in Browse Collection panel for instant cache bypass

### Fixed

- **Album Details Caching**: Instant display with smart 24h background refresh reduces API calls
- **Collection Updates**: New release-groups now visible after reload (fixed Next.js fetch caching)

## [0.20.0] - 2025-11-28

### Changed

- **Release Selection Logic**: Album details now prioritize official releases sorted by date
  - Filter to `status === 'Official'` releases first (fallback to all if none exist)
  - Sort by release date ascending (oldest first = original release)
  - Updated `selectPreferredRelease()` in [api.ts:41-56](../src/utils/api.ts#L41-L56)
  - Note: Streaming link discovery remains independent and unchanged

## [0.19.10] - 2025-11-27

### Fixed

- **Auth Refresh Race Condition**: Fixed duplicate 401 errors on `/api/auth/refresh` endpoint
  - Added `useRef` guard to prevent concurrent refresh attempts in [useAuth.ts:73-76](../src/hooks/useAuth.ts)
  - Eliminates race condition when React StrictMode double-invokes effects in development
  - Prevents token rotation conflicts from multiple simultaneous refresh requests

## [0.19.9] - 2025-11-27

### Removed

- **Dead Code Cleanup**: Removed unused `CacheStatusIndicator` component
  - Deleted [CacheStatusIndicator.tsx](../src/components/CacheStatusIndicator.tsx) (147 lines)
  - Fixed stale `@ai` annotation in [Header.tsx](../src/components/Header.tsx)

## [0.19.8] - 2025-11-27

### Removed

- **Dead Code Cleanup**: Removed unused `CollectionSelector` component
  - Deleted [CollectionSelector.tsx](../src/components/CollectionSelector.tsx) (117 lines)
  - Fixed stale `@ai` annotations in [Header.tsx](../src/components/Header.tsx)
  - Component was previously removed from config page in v0.14.6, replaced by `CollectionBrowsePanel`

## [0.19.7] - 2025-11-27

### Changed

- **Environment Variable Cleanup**: Removed redundant non-prefixed environment variables
  - Removed `MUSICBRAINZ_APP_NAME` and `MUSICBRAINZ_CONTACT_EMAIL` (duplicates of `NEXT_PUBLIC_*` versions)
  - Updated [userAgent.ts](../src/utils/config/userAgent.ts) to use only `NEXT_PUBLIC_*` variables
  - Simplified [.env.example](../.env.example) configuration
  - No breaking changes - only `NEXT_PUBLIC_*` versions needed

## [0.19.6] - 2025-11-27

### Removed

- **Dead Code Cleanup**: Removed unused admin section settings (development-only)
  - Removed `userAgent` setting - API uses environment variables only
  - Removed `useDirectApi` setting - always uses proxy
  - Removed `enableCaching` setting - never used
  - Removed `logErrors` setting - errors always logged
  - Simplified [ApiConfiguration](../src/types/preferences.ts) interface to only `collectionId`
  - Cleaned up [preference-migration.ts](../src/utils/preference-migration.ts) and [collection-handler.ts](../src/utils/collection-handler.ts)

## [0.19.5] - 2025-11-27

### Changed

- **Settings UI Consistency**: Reduced text size and checkbox size in Rating Display section to match other settings elements
  - Changed heading font weight from semibold to medium
  - Reduced checkbox size from 20px to 16px
  - Reduced label text from default to text-sm (14px)
  - Changed label color from white to gray (text-secondary)

## [0.19.4] - 2025-11-24

### Fixed

- **Ratings Display**: Fixed crash when `undefined` ratings are passed to display components
  - Added defensive validation in [formatRatingDisplay()](../src/utils/ratings.ts) to handle null/undefined values
  - Changed strict null checks (`!== null`) to loose equality (`!= null`) in [StarRating.tsx](../src/components/StarRating.tsx) to catch both null and undefined
  - Changed strict null checks (`!== null`) to loose equality (`!= null`) in [AlbumDetailsPanel.tsx](../src/components/AlbumDetailsPanel.tsx) for both average and personal ratings
  - Prevents "Cannot read properties of undefined (reading 'toFixed')" runtime errors that could occur from cache corruption or schema mismatches

## [0.19.3] - 2025-11-21

### Documentation

- Simplified README.md with complete self-hosting instructions (149 → 151 lines, improved clarity)
- Application renamed to `collection-browser-for-musicbrainz` throughout documentation
- Removed emojis from README for professional presentation
- Standardized to port 3000 in all public documentation
- Added comprehensive OAuth setup section directly in README

## [0.19.2] - 2025-11-21

### Changed

- **Code Cleanup**: Comprehensive codebase simplification reducing ~1,577 lines (20% reduction)
  - Removed unused [performance-monitor.ts](../src/utils/performance-monitor.ts) utility (129 lines)
  - Centralized auth cookie configuration in [auth-cookies.ts](../src/utils/auth-cookies.ts) preventing session bugs
  - Consolidated OAuth request logic in [oauth.ts](../src/utils/oauth.ts)
  - Simplified [ProgressiveLoader](../src/utils/progressive-loader.ts) from 426-line class to 236-line functional module
  - Trimmed excessive @ai annotations across all 59 source files (~960 lines)
  - Removed identity functions from [ratings.ts](../src/utils/ratings.ts)
  - Extracted shared normalization functions to [string-normalization.ts](../src/utils/string-normalization.ts)
  - Fixed semicolon formatting issues
  - No user-facing changes or breaking changes

## [0.19.1] - 2025-11-21

### Fixed

- Genre tags now maintain consistent vertical position when ratings are hidden

## [0.19.0] - 2025-11-20

### Added

- **Production Deployment Guide**: Created comprehensive `docs/DEPLOYMENT.md` documentation
  - Environment configuration for production
  - Platform-specific deployment instructions (Vercel, Railway, Docker, AWS)
  - Security best practices and troubleshooting guide
  - Post-deployment verification checklist

### Changed

- **Console Logging Cleanup**: Removed ~30+ debug console.log statements for production
  - Removed filter debugging logs in [page.tsx](../src/app/page.tsx)
  - Removed album fetch lifecycle logs in [useAlbums.ts](../src/hooks/useAlbums.ts)
  - Removed auth state logs in [useAuth.ts](../src/hooks/useAuth.ts)
  - Removed preference sync logs in [usePreferences.ts](../src/hooks/usePreferences.ts)
  - Removed grid rendering logs in [AlbumGrid.tsx](../src/components/AlbumGrid.tsx)
  - Removed rate limiting logs in API routes
  - **Kept**: console.error for production error tracking
  - Result: Cleaner production logs, better performance, no information leakage

### Fixed

- **API Route Consistency**: Added missing `dynamic = 'force-dynamic'` export to [/api/auth/logout/route.ts](../src/app/api/auth/logout/route.ts)
  - Matches pattern used in all other API routes
  - Ensures proper dynamic runtime behavior

### Documentation

- **Port Clarification**: Updated CLAUDE.md to reflect development (port 3002) vs production (port 3000) usage
- **Production Ready**: Application successfully builds and runs in production mode

## [0.18.2] - 2025-11-20

### Fixed

- **Next.js Build Errors**: Fixed static generation errors preventing production builds
  - Added `export const dynamic = 'force-dynamic'` to 10 API routes using dynamic request data
  - Wrapped Header component in Suspense boundary to support `useSearchParams()`
  - All routes now properly marked as dynamic for runtime rendering

## [0.18.1] - 2025-11-20

### Fixed

- **Album Details Cache Persistence**: Fixed album details not persisting in IndexedDB cache
  - Added 30-day TTL (Time To Live) implementation to album details cache
  - Album details now stored with `_cachedAt` and `_expiresAt` timestamps
  - Cache retrieval now checks expiry and returns null for expired entries
  - Matches the TTL pattern already implemented for streaming links (7-day TTL)
  - Legacy cache entries without expiry timestamps are still returned (backwards compatible)

### Improved

- **IndexedDB Fallback Logging**: Enhanced error visibility when IndexedDB is blocked
  - Upgraded from `console.warn` to `console.error` for blocked database events
  - Improved message clarity: explains memory-only mode and how to restore persistent caching
  - Helps developers identify when cache won't persist across page reloads

## [0.18.0] - 2025-11-20

### Added

- **Open Source Release Preparation**: Code cleanup and documentation for GitHub public release
  - Created `.env.example` with placeholder values for easier contributor setup
  - Created `LICENSE` file (MIT License)
  - Added @ai annotations to 26 core files for better AI assistant support (utilities, components, API routes)

### Removed

- **Development Files**: Removed 9 debug/test files not needed for production
  - Removed debug pages (`/debug`, `/debug/advanced`, `/compare`, `/tailwind-test`)
  - Removed debug utilities (`debug-collection-force.ts`, `direct-api-test.ts`, `useDebugAlbums.ts`)
  - Removed debug API endpoints (`/api/debug-collection`, `/api/debug-compare`)
- **Unused Dependencies**: Removed `@heroicons/react` (project uses `react-icons/bi` consistently)

### Changed

- **Documentation**: Completely rewrote CLAUDE.md following best practices for clarity and conciseness
- **Code Organization**: Improved code documentation for open-source contributors

## [0.17.2] - 2025-11-20

### Fixed

- **Album Details Loading Race Conditions**: Eliminated UI flickering when rapidly switching between albums
  - Implemented AbortController-based cancellation for all API requests
  - Previous album details and streaming links fetches now abort when user selects a new album
  - Prevents stale responses from overwriting current album data
  - Reduces wasted bandwidth on canceled requests

### Technical Details

- Added AbortSignal support to streaming links utility functions
- Added cleanup function to AlbumDetailsPanel streaming links useEffect
- Implemented AbortController ref in useAlbums hook
- Propagated AbortSignal through entire API call chain (fetchReleaseGroup, fetchReleaseUrlRels, fetchStreamingLinksForAlbum)

## [0.17.1] - 2025-11-20

### Improved

- **Welcome Screen UX**: Enhanced first-time user experience with direct collection input
  - Collection ID/URL input field now displayed directly on welcome screen
  - Added "Login with MusicBrainz" button on welcome screen for easy access to personal collections
  - Removed "Go to Settings" button in favor of more direct actions

- **Collection Browser Login**: Added direct login button to browse collections panel
  - Users can now log in directly from the collections panel when not authenticated
  - Eliminates need to navigate through menu to access login

## [0.17.0] - 2025-11-19

### Added

- **Public Collection Browsing**: Users can now browse public MusicBrainz collections without logging in
  - Collection ID/URL input field accessible to all users
  - Validation automatically distinguishes public vs. private collections
  - Login only required to view personal collections list

### Changed

- "Browse Collections" menu item now accessible to unauthenticated users
- Simplified collection panel layout with unified input field

## [0.16.1] - 2025-11-19

### Fixed

- **Label Click Functionality**: Disabled label clicking in album details panel when label filter is turned off
  - Labels now render as plain text instead of clickable buttons when `enableLabelFilter` is false
  - Prevents confusion from clicking labels when the filter UI is hidden

## [0.16.0] - 2025-11-19

### Added

- **Optional Label Filter**: Label filtering can now be disabled in settings (off by default)
  - New `enableLabelFilter` preference in Display Settings
  - Label filter category hidden when disabled
  - Reduces UI complexity for users who don't need label filtering

### Changed

- Label filter now opt-in instead of always visible
- Updated preferences type system with `enableLabelFilter` boolean

## [0.15.1] - 2025-11-19

### Fixed

- **Session Persistence on Browser Reload**: Fixed critical bug where users were logged out when reloading the browser
  - Extended `mb_token_expires_at` cookie lifetime from 1 hour to 90 days (matching refresh token)
  - Cookie now persists across browser restarts and reloads
  - Auto-refresh mechanism properly triggers when access token expires
  - Users stay logged in for the full 90-day session duration

### Improved

- **Collection Loading Performance**: Optimized useAlbums hook to prevent redundant fetches
  - Removed redundant `externalCollectionId` dependency from useEffect
  - Eliminated potential double-fetch on collection initialization
  - Improved loading efficiency

### Technical Details

- Modified `src/app/api/auth/callback/route.ts` (line 108)
- Modified `src/app/api/auth/refresh/route.ts` (line 69)
- Changed `maxAge` from `tokenResponse.expires_in` (~1 hour) to `90 * 24 * 60 * 60` (90 days)
- Modified `src/hooks/useAlbums.ts` (line 263): Removed `externalCollectionId` from useEffect dependency array

## [0.15.0] - 2025-11-18

### Security

- **CRITICAL: Fixed SSRF Vulnerability in Image Proxy**
  - Added URL allowlist to `/api/image` endpoint (only coverartarchive.org and archive.org CDNs)
  - Removed Host header usage to prevent header injection attacks
  - Validates all image URLs against allowlist before fetching
  - Blocks access to internal network resources and cloud metadata endpoints

- **Access Token Security Enhancement**
  - Changed `mb_access_token` cookie from `httpOnly: false` to `httpOnly: true`
  - Access tokens now protected from JavaScript access (XSS mitigation)
  - Updated `useAuth` hook to work with httpOnly tokens via server-side API calls
  - Updated auth callback and refresh routes with httpOnly cookies

- **Comprehensive Security Headers**
  - Added Content Security Policy (CSP) with strict directives
  - Added X-Frame-Options: DENY (clickjacking protection)
  - Added X-Content-Type-Options: nosniff (MIME sniffing protection)
  - Added Referrer-Policy: strict-origin-when-cross-origin
  - Added Permissions-Policy to disable unused browser features
  - CSP allows only trusted sources: self, MusicBrainz, Cover Art Archive, Odesli, Apple Music

- **Input Validation and Bounds Checking**
  - Image dimensions clamped to 1-2000 pixels (prevents DoS via resource exhaustion)
  - Image quality clamped to 1-100 range
  - Added isNaN checks on all parseInt results
  - Validates URL parameters before processing

- **Debug Endpoint Protection**
  - `/api/debug-collection` endpoint now disabled in production
  - Returns 404 when NODE_ENV !== 'development'
  - Prevents unauthorized collection enumeration

### Technical Details

- Modified files:
  - `src/app/api/image/route.ts` - SSRF fix, input validation
  - `src/app/api/auth/callback/route.ts` - httpOnly access token
  - `src/app/api/auth/refresh/route.ts` - httpOnly access token
  - `src/hooks/useAuth.ts` - Updated for httpOnly token handling
  - `src/app/api/debug-collection/route.ts` - Production guard
  - `next.config.js` - Security headers configuration

### Breaking Changes

- Access tokens are no longer accessible to client-side JavaScript
- All authenticated API calls must go through server-side routes
- Debug endpoint `/api/debug-collection` unavailable in production

## [0.14.9] - 2025-11-18

### Added

- **Version Display**: Settings page now shows current app version from package.json

### Technical Details

- Added Version Information section to settings page below streaming services configuration
- Version dynamically read from package.json for single source of truth

## [0.14.8] - 2025-11-18

### Fixed

- **Session Persistence**: Users now stay logged in for 90 days instead of requiring daily re-authentication
  - Fixed race condition in auth initialization where cookies weren't ready on mount
  - Fixed collection selection resetting on app restart
  - Extended refresh token cookie expiration from 7 days to 90 days
- **Auth State Management**: Removed duplicate token storage in localStorage
  - Tokens now stored exclusively in httpOnly cookies for better security
  - localStorage only stores username/userId for UI display

### Technical Details

- Added dependency array to `useAuth` hook's initialization effect to re-check when cookies change
- Added dependency array to collection ID initialization in `page.tsx` to update when preferences load
- Updated refresh token `maxAge` in `callback/route.ts` and `refresh/route.ts` (7 days → 90 days)
- Removed `accessToken` and `expiresAt` from `AuthPreferences` interface
- Updated all `updateAuth()` calls to exclude token data

## [0.14.7] - 2025-11-18

### Added

- **Health Check Endpoint**: New `/api/health` endpoint for monitoring API availability
  - Returns JSON with status, timestamp, and service name
  - Useful for deployment health checks and monitoring systems

### Technical Details

- Created `src/app/api/health/route.ts` with simple GET handler
- Returns 200 OK with `{ status: 'ok', timestamp: ISO8601, service: 'MusicBrainz GUI API' }`

## [0.14.6] - 2025-10-17

### Changed

- **Settings Page Cleanup**: Removed collection ID configuration from Settings page
  - Collection management now exclusively via Browse Collections panel (header menu)
  - Settings page focused on preferences: display options, streaming services, rating display
  - Eliminates unwanted page reloads from collection ID changes

### Technical Details

- Removed collection ID input, validation state, and CollectionSelector from `src/app/config/page.tsx`
- Updated documentation to reflect Browse Collections panel as primary collection management interface

## [0.14.5] - 2025-10-17

### Fixed

- **TypeScript Compilation**: Resolved all 7 TypeScript errors preventing clean builds
  - Fixed type re-export for `SortOption` in preferences module
  - Fixed iterator compatibility issues for ES5 target in pkce.ts and db/index.ts
  - Fixed API response destructuring in collection-handler.ts and debug page

### Technical Details

- Added `export type` declaration for `SortOption` in `src/types/preferences.ts`
- Added `downlevelIteration: true` to `tsconfig.json` for better ES5 iterator support
- Wrapped iterators with `Array.from()` for Map.entries() and Uint8Array spread operations
- Updated collection fetch calls to properly destructure `{ releaseGroups, collectionName }` return object

## [0.14.4] - 2025-10-17

### Fixed

- **Collection Loading**: Collections now load automatically when switching via Browse Collections panel
  - Eliminated need for manual page refresh after selecting different collection
  - Uses direct prop passing with local state management for clean React data flow
  - Avoids infinite loop issues from previous custom event-based synchronization attempts

### Improved

- **Image API Logging**: Reduced console noise from expected cover art loading failures
  - 404 errors (missing cover art): Downgraded from ERROR to INFO level
  - Network timeouts: Downgraded from ERROR to WARNING level with simplified message
  - Cleaner console output for better developer experience

### Technical Details

- Modified `useAlbums` hook to accept optional `externalCollectionId` parameter
- Added local `activeCollectionId` state in `page.tsx` for triggering automatic reloads
- Updated `handleLoadCollection` to set local state instead of manual `setTimeout` + `refreshAlbums()` pattern
- Enhanced `/api/image` route with tiered error logging based on severity and expectedness

## [0.14.3] - 2025-10-16

### Fixed

- **Clear All Filters Bug**: Fixed X button remaining visible after clearing all filters
- **OAuth Callback Loop**: Fixed periodic page reloads caused by OAuth callback
  - Added early return guard in Header component to prevent router.replace loop

## [0.14.2] - 2025-10-16

### Changed

- **Rating Fetch Optimization**: Ratings now fetched with initial collection query instead of only on album detail view
  - Ratings appear immediately on album grid without requiring detail fetch
  - Rating filter now works instantly without opening album details first
  - Reduces redundant API calls by ~90%
  - Initial API response ~10-20% larger but provides better UX

### Technical Details

- Modified `release-groups-helper.ts` to include `+ratings` in initial collection fetch
- Added rating extraction to `normalize-mb-data.ts` during data normalization
- Maintains backward compatibility with cached data and standalone detail fetches

## [0.14.1] - 2025-10-16

### Fixed

- **Rating Display Bug**: Fixed ratings showing incorrect values (e.g., 0.1 instead of 3.0)
  - Removed unnecessary 0-100 scale conversion; MusicBrainz API already returns 0-5 scale
  - Ratings now stored and displayed directly in 0-5 scale without conversion
- **Star Rendering**: Updated to solid filled stars with cleaner visual design
  - Filled/half stars: bright grey solid icons
  - Empty stars: darker grey hollow outline
  - Ratings rounded to 0.5 steps for cleaner half-star display
- **Rating UI Refinements**: Simplified display format
  - Removed redundant numeric rating next to stars
  - Changed vote count format from "(2 ratings)" to "(2)"

## [0.14.0] - 2025-10-16

### Added

- **5-Star Rating System**: View-only community average ratings from MusicBrainz
- **Rating Filter**: Filter albums by 0-5 star range with double slider
- **Rating Preferences**: Configuration UI for visibility toggle

### Changed

- **FilterPanel**: Added fifth filter category for ratings (amber star icon)
- **AlbumDetailsPanel**: Displays community star ratings below artist name

### Notes

- Personal ratings UI present but not yet functional (requires OAuth token forwarding implementation)

## [0.13.1] - 2025-10-12

### Added
- Manual collection input field in Collections panel with real-time validation and URL auto-extraction

### Changed
- Collection cards now fully clickable for instant loading (removed individual Load buttons)
- Collections grouped into "My Collections" and "Collaborative Collections" sections
- Simplified card design with "Current" badge and cleaner layout

### Fixed
- **Panel Overlay Behavior**: Fixed all panels and active filters bar to overlay content instead of pushing it down
  - Changed positioning from `sticky` to `fixed` for proper overlay behavior
  - Panels and filters bar now appear on top of album grid without affecting page layout
  - Eliminates unwanted scrolling and layout shifts when panels open
  - Affected components: FilterPanel, AlbumDetailsPanel, CollectionBrowsePanel, ActiveFiltersBar

### Known Issues
- Manual input requires page reload (collection cards work correctly)

## [0.13.0] - 2025-10-12

### Added

- **Browse Collections Panel**: New collapsible panel for viewing and managing all user collections
  - Panel component similar to AlbumDetailsPanel and FilterPanel
  - Stacked list layout showing all release-group collections
  - Each collection displays: name, editor, album count, collection type
  - Visual indicator for currently loaded collection
  - "Load Collection" action to switch collections instantly
  - "View on MusicBrainz" action to open collection in new tab
  - Sticky positioning with close button (hover-visible on desktop)
  - Authentication-gated (shows login prompt for unauthenticated users)
  - Empty state with link to create collections on MusicBrainz.org
  - Loading and error states with appropriate feedback
  - Responsive design matching app's dark theme and glass morphism styling
  - Automatic collection refresh after loading new collection

### Changed

- **Header Navigation**: Added "Browse Collections" menu item
  - New menu entry with BiCollection icon
  - Positioned between authentication section and settings
  - Always visible (grayed out when not authenticated with tooltip)
  - Toggles panel instead of navigating to separate page
- **Panel Management**: Enhanced mutual exclusivity
  - Opening Collections panel closes Album Details and Filter panels
  - Opening any panel closes the others
  - Title click closes all panels including Collections panel

### Technical Details

- **New Component**:
  - `src/components/CollectionBrowsePanel.tsx` - Collapsible panel component
- **Modified Components**:
  - `src/components/Header.tsx` - Added panel toggle support
  - `src/app/page.tsx` - Integrated panel with state management
- **API Integration**: Reuses existing `/api/musicbrainz/collections` endpoint
- **State Management**: Panel open/close state managed in main page component
- **Navigation Flow**: Load collection → update preferences → refresh albums → close panel

## [0.12.5] - 2025-10-12

### Changed

- **Header Visual Refinements**: Improved header styling and layout consistency
  - Reduced collection name size to text-sm with bold weight for cleaner appearance
  - Removed icon and button-style container from collection name (text-only display)
  - Changed header background to match main grid color (rgba(18,18,18,0.85))
  - Increased header transparency (85% opacity) with backdrop blur for modern glass effect
  - Optimized bottom padding (pb-4) to prevent overlap with panels
  - Increased search bar height (py-2.5) to match button heights for visual balance

### Technical Details

- **Modified Components**:
  - `src/components/Header.tsx` - Simplified collection name, updated background styling
  - `src/components/SearchBar.tsx` - Adjusted vertical padding for consistent height

## [0.12.4] - 2025-10-12

### Changed

- **Header Navigation Refinements**: Improved menu UX and simplified header layout
  - Removed standalone settings icon from desktop header (accessible via menu only)
  - Menu dropdown now overlays content instead of pushing it down
  - Very rounded corners (rounded-3xl) for consistent design language
  - Simplified authentication display: shows icon, username, and logout button
  - Removed verbose "Logged in as" text for cleaner appearance
  - Menu auto-closes when clicking outside or pressing Escape key

### Technical Details

- **Modified Components**:
  - `src/components/Header.tsx` - Absolute positioned menu overlay with click-outside handlers
- **UX Improvements**: Click-outside and Escape key functionality using event listeners
- **Styling**: Increased opacity (95%), rounded-3xl corners, z-50 layering, shadow-lg depth

## [0.12.3] - 2025-10-12

### Changed

- **Authentication UI Location**: Moved MusicBrainz authentication from settings page to header menu
  - Login/logout controls now in hamburger menu dropdown for easier access
  - Shows BiUserX icon (white/70) when not logged in
  - Shows BiUserCheck icon (primary violet) + username when authenticated
  - Logout button displays BiLogOut icon (red-400)
  - No navigation to settings required for authentication
  - Settings page simplified, now focused on configuration only
  - Auth state always visible and accessible from any page
  - Menu auto-closes after login/logout actions

### Technical Details

- **Modified Components**:
  - `src/components/Header.tsx` - Added auth section to menu dropdown using `useAuth` hook
  - `src/app/config/page.tsx` - Removed authentication UI section
- **Icons**: BiUserX, BiUserCheck, BiLogOut from react-icons/bi
- **Behavior**: Authentication functionality unchanged, only UI location moved
- **Backward Compatible**: All OAuth2 flows and token management work identically

## [0.12.2] - 2025-10-12

### Added

- **Universal Menu Button**: Menu icon now available across all screen sizes for consistent navigation
  - Desktop/Tablet: Menu button appears on left side next to collection name
  - Mobile: Existing menu button retained for compact layout
  - Menu dropdown provides quick access to Settings
  - Collection name remains visible on desktop/tablet (only in dropdown on mobile)
  - Consistent glass morphism styling across all breakpoints

## [0.12.1] - 2025-01-07

### Changed

- **Mobile Album Details Panel**: Optimized layout and UX for small screens
  - Center-aligned content (cover art, album info, streaming links)
  - Improved padding: 12px top on container, 24px top/bottom on content
  - Streaming icons increased 40% (34px vs 24px) for better touch targets
  - Close button repositioned to align with cover art

## [0.12.0] - 2025-01-07

### Changed

- **Mobile UI Optimization**: Comprehensive improvements for mobile devices
  - Album cards reduced to fit 3 per row (115px min width vs 180px desktop)
  - Compact single-row header with hamburger menu (56px height vs 96px)
  - Reduced padding and smaller typography on mobile for better space utilization
  - Dynamic filter bar height tracking with ResizeObserver prevents panel overlap
  - Responsive grid columns: 115px (mobile), 140px (tablet), 180px (desktop)

## [0.11.1] - 2025-01-07

### Changed

- **Panel Layout**: Added horizontal spacing (8px mobile, 12px desktop) and repositioned close buttons to scroll with panels
  - Close buttons now properly aligned in upper right corner during scrolling
  - Maintains desktop hover-to-show behavior

## [0.11.0] - 2025-01-07

### Added
- **OAuth2 Authentication with PKCE**: Implemented passwordless login for MusicBrainz accounts
  - **OAuth2 Flow**: Full OAuth2 implementation with PKCE (Proof Key for Code Exchange) for enhanced security
  - **Scopes**: `profile` (user info) and `collection` (collection access)
  - **New API Endpoints**:
    - `/api/auth/login` - Initiates OAuth2 flow with state and PKCE parameters
    - `/api/auth/callback` - Handles OAuth2 callback and token exchange
    - `/api/auth/profile` - Fetches user profile from `/oauth2/userinfo` endpoint
    - `/api/auth/refresh` - Refreshes expired access tokens using refresh token
    - `/api/auth/logout` - Revokes tokens and clears session
  - **Token Management**:
    - Access tokens stored in cookies (short-lived, ~1 hour)
    - Refresh tokens stored in httpOnly cookies (7-day expiry)
    - Automatic token refresh via `useAuth` hook when tokens expire
  - **Security Features**:
    - PKCE code challenge/verifier prevents authorization code interception
    - State parameter for CSRF protection
    - httpOnly cookies prevent XSS attacks
  - **New Files**:
    - `src/app/api/auth/*` - OAuth2 API routes
    - `src/hooks/useAuth.ts` - Authentication state management hook
    - `src/utils/oauth.ts` - OAuth URL builders and token utilities
    - `src/utils/pkce.ts` - PKCE code generation
    - `src/types/auth.ts` - Authentication type definitions
  - **Reference**: MusicBrainz OAuth2 documentation

- **Private Collection Support**: Access private collections when authenticated
  - **Collection Selector**: Dropdown showing all user's release-group collections (public + private)
  - **Automatic Filtering**: Only shows release_group type collections (not releases, artists, etc.)
  - **Collection API**: `/api/musicbrainz/collections` endpoint with `inc=user-collections` parameter
  - **OAuth Integration**: All MusicBrainz API requests include Bearer token when user is logged in
  - **Backward Compatible**: Manual collection ID entry still works without authentication

### Changed
- **API Architecture Refactoring**: Removed Next.js rewrites to enable OAuth authentication
  - **Root Cause**: `next.config.js` rewrites were bypassing API route handlers, preventing OAuth token attachment
  - **Solution**: Removed `/api/musicbrainz` rewrite; requests now go through API route handlers
  - **Catch-All Route**: Created `/api/musicbrainz/[...path]/route.ts` to handle all MusicBrainz API paths
  - **OAuth Token Forwarding**: API proxy automatically includes `Authorization: Bearer {token}` header when cookies present
  - **Benefits**:
    - Enables private collection access
    - Centralized authentication logic
    - Proper rate limiting enforcement
    - Better error handling

- **Centralized API Client**: Consolidated MusicBrainz API calls through shared axios instance
  - **Exported `mbApi`**: Shared axios instance from `src/utils/api.ts` with `withCredentials: true`
  - **Refactored `release-groups-helper.ts`**: Now uses `mbApi` instead of raw axios
  - **Benefits**:
    - Single source of truth for API configuration
    - Consistent cookie forwarding across all requests
    - Easier maintenance and updates

### Fixed
- **Collection Type Filter**: Fixed entity type from `release-group` (hyphen) to `release_group` (underscore)
  - **Impact**: Collections endpoint was returning 0 items even when release-group collections existed
  - **Root Cause**: MusicBrainz API returns `entity-type: "release_group"` with underscore, not hyphen
  - **Fix**: Updated filter in `/api/musicbrainz/collections/route.ts`

- **Collection Validation Error Messages**: Improved error messages for private collections
  - Added specific 401 handling with message: "This collection is private. Please log in with MusicBrainz to access it."
  - Updated 404 message to mention authentication option
  - Better user guidance for authentication requirements

## [0.10.3]

### Added
- **Collection ID Validation**: Real-time validation in config page
  - Accepts MBIDs or full MusicBrainz URLs (auto-extracts ID)
  - Validates format, collection existence, and type (release_group)
  - Visual feedback: spinner (validating), checkmark (valid), error icon (invalid)
  - Debounced validation (800ms) using established `/api/musicbrainz` proxy
  - New utility: `src/utils/mbid-validation.ts`

## [0.10.2]

### Added
- **Apple Music Geo Link Resolution**: Implemented intelligent resolution for Apple Music geo links
  - **New API Endpoint**: `/api/resolve-apple-music` - Resolves `geo.music.apple.com` URLs to final destinations
  - **Backend Resolution**: Uses `axios.head()` to follow redirect chains (up to 5 redirects) server-side
  - **Desktop App Support**: Resolved URLs automatically converted to `music://` protocol for Apple Music app
  - **Caching Strategy**:
    - localStorage cache (`appleMusicGeoCache`) with 7-day TTL
    - Instant resolution on repeat album views
    - Automatic cache expiration and cleanup
  - **Graceful Fallback**: Original geo URL used if resolution fails
  - **Files Changed**:
    - `src/app/api/resolve-apple-music/route.ts`: New API endpoint for geo link resolution
    - `src/components/StreamingLinksSection.tsx`: Added async URL resolution with useState/useEffect
  - **Benefits**:
    - Enables proper desktop app integration for geo links
    - Prevents broken links in different regions
    - Improves UX with instant cached resolution (<100ms)

### Fixed
- **Apple Music iTunes Link Issue**: Fixed issue where iTunes links were displayed instead of Apple Music links
  - **Root Cause**: Odesli API returns both `itunes` and `appleMusic` keys, but both were mapping to same field
  - **Impact**: iTunes links (with `app=itunes` parameter) were overwriting Apple Music streaming links
  - **Solution**: Modified `parseOdesliResponse()` in `src/utils/streaming-links.ts` to skip `itunes` key entirely
  - **Outcome**: Only genuine Apple Music streaming links are displayed; no fallback to iTunes

## [0.10.1] - 2025-10-06

### Fixed
- **MusicBrainz API 25-Release Limit on Lookup Endpoints**: Fixed architectural issue where lookup endpoints cap nested releases at 25 items
  - **Root Cause**: MusicBrainz API lookup endpoints (e.g., `/release-group/{id}`) limit nested entities to 25 items, regardless of `limit` parameter
  - **Impact**: Albums with >25 releases only returned first 25, often missing Digital Media + Worldwide releases needed for streaming links
  - **Example**: Pablo Honey by Radiohead - was getting 25 releases (0 XW), now gets 33 releases (3 XW)
  - **Solution**: Two-step fetch process using both lookup and browse endpoints:
    1. Fetch release group basic info: `/release-group/{id}?inc=artist-credits+genres+tags` (no releases)
    2. Fetch up to 100 releases via browse endpoint: `/release?release-group={id}&inc=media&limit=100`
  - **Files Changed**:
    - `src/utils/api.ts`: Refactored `fetchReleaseGroup()` to use two-step process with 1-second rate limit delay
    - `src/utils/release-groups-helper.ts`: Removed `+releases+media` from collection endpoint (doesn't support it properly)
  - **Performance**: Adds 1-second delay per album detail view (rate limiting) but significantly improves streaming link success rate
  - **Reference**: See MusicBrainz API docs - lookup endpoints vs browse endpoints

### Changed
- **Release Group Fetching Architecture**: Migrated from single lookup endpoint to two-step fetch strategy
  - Browse endpoint respects `limit` parameter (up to 100), unlike lookup endpoint's fixed 25-item limit
  - Enables proper Digital Media + Worldwide release detection for streaming link discovery
  - Maintains proper rate limiting with 1-second delay between sequential requests

## [0.10.0] - 2025-10-06

### Fixed
- **Streaming Links Not Appearing**: Fixed critical bug where streaming platform links were not appearing for most albums
  - **Root Cause**: Release-group API call was missing the `+media` parameter in the `inc` query string
  - **Impact**: Without media format information, the release selection logic couldn't identify Digital Media + Worldwide releases
  - **Result**: Wrong release was being selected (typically the first in the array), which often lacked streaming URL relationships
  - **Fix**: Added `+media` to inc parameter in `src/utils/api.ts` (line 93)
  - **Changed**: `inc: 'artist-credits+releases+genres+tags'` → `inc: 'artist-credits+releases+media+genres+tags'`
  - **Outcome**: Correct Digital Media + Worldwide releases are now selected, streaming URLs are successfully extracted and displayed
  - This fix enables streaming links to work for all albums that have them in MusicBrainz

- **Incomplete Digital Media + Worldwide Release Checking**: Fixed issue where only the first Digital Media + Worldwide release was checked, plus 3 random fallbacks
  - **Root Cause**: The fallback limit of 3 releases was applied uniformly across all release priority tiers
  - **Impact**: If a release group had 5+ Digital Media + XW releases, and the one with streaming URLs was the 5th, it would never be checked
  - **Example**: Pablo Honey (cd76f76b-ff15-3784-a71d-4da3078a6851) has multiple XW releases but only 4 were being queried
  - **Fix**: Modified `findStreamingUrlWithFallback()` in `src/utils/streaming-links.ts` to try ALL Digital Media + XW releases without limit
  - **Implementation**: Separated release prioritization into tiers, applying limit only to lower-priority tiers (non-XW digital and physical)
  - **Outcome**: Never miss streaming links from any Digital Media + Worldwide release, while still limiting API calls for less-likely releases
  - **Performance**: Minimal impact as most albums have 2-5 XW releases maximum

## [0.9.8] - 2025-10-04

### Changed
- **FilterPanel UI Redesign**: Replaced dropdown category selector with horizontal scope/category bar
  - Category selector now uses pill-shaped button bar design (similar to GitHub chart scope selector)
  - Glass morphism pill container: `bg-[#2A2A2A]/60 backdrop-blur-md border border-white/10 rounded-full`
  - All four categories (Genres, Tags, Record Labels, Release Date) displayed as horizontal buttons
  - Active state shows color-coded backgrounds: purple (genres), orange (tags), rose (labels), fuchsia (dates)
  - Inactive buttons show subtle hover effects with transparent backgrounds
  - Responsive design: Text labels hidden on mobile (icons only), shown on larger screens
  - Improved accessibility with direct category switching (no dropdown navigation required)
  - Cleaner, more modern interface with better visual hierarchy

## [0.9.7] - 2025-10-01

### Added
- **Release Date Filter Category**: Added fourth filter category for filtering albums by release year range
  - New date-processor.ts utility for extracting years from `album.first_release_date` and range filtering
  - BiCalendar icon for release date category in filter panel dropdown
  - Fuchsia-400 accent color for date range filter chip (distinguishes from other categories)
  - Double-ended range slider with draggable fuchsia-400 handles (20px width)
  - Wider thumbs with fuchsia-300 hover outline for better visibility
  - Manual year input fields positioned left and right of slider bar with validation (blur/enter to apply)
  - Year inputs have darker default background (#1A1A1A/90) with hover brightening effect
  - Defaults to full available year range in collection
  - Minimum range: single year (same year for min/max allowed)
  - Active range highlighted with fuchsia-400/60 color on slider track
  - Albums without valid dates are excluded from filtering
  - **Intelligent Overlapping Thumb Handling**: When both thumbs at same year:
    - Thumbs separate with 4px visual gap (min shifts 2px left, max shifts 2px right)
    - Mouse position-based z-index switching for independent thumb access
    - Hover left of thumb center → min thumb becomes active and grabbable
    - Hover right of thumb center → max thumb becomes active and grabbable
    - Dynamic z-index updates based on mouse X position over slider
  - Active filter chip shows single year when min === max, range otherwise (e.g., "2025" vs "1990 - 2025")
  - Full localStorage persistence for date range selections
  - Updated FilterPanel, ActiveFiltersBar, useFilters hook, and page.tsx for four-category support
  - AND logic between all four categories (genres, tags, labels, release dates)
  - Search bar hidden when Release Date category is active (not applicable)

### Changed
- **Panel Styling Enhancement**: Updated AlbumDetailsPanel and FilterPanel with modern rounded corners and borders
  - Increased border radius to `rounded-3xl` (24px) for more prominent rounded corners
  - Added subtle light border with `border-white/10` (10% opacity white)
  - Enhanced visual distinction while maintaining glass morphism effects
  - Consistent styling across both panels for unified design language
- **Filter Category Order**: Updated category dropdown order to Genres, Tags, Record Labels, Release Date (bottom)

## [0.9.6+] - 2025-10-01

### Added
- **Tags Filter Category**: Added third independent filter category for non-official tags
  - New tag-processor.ts utility for extracting and filtering album tags
  - BiPurchaseTag icon for tags category in filter panel dropdown
  - Orange-400 accent color for selected tags (distinguishes from purple genres and rose labels)
  - Tags extracted from `album.tags` field but **excludes official genres**
  - Official genres only appear in Genres category (no duplication)
  - Per-album genre exclusion logic ensures accurate tag filtering
  - Full localStorage persistence for tag filter selections
  - Updated FilterPanel, ActiveFiltersBar, and useFilters hook for three-category support
  - AND logic between all three categories (genres, labels, tags)
- **Floating Chevron Expand/Collapse Toggle**: Added expandable filter chips for large categories
  - Categories with >25 items display floating chevron button at bottom border of filter panel
  - Dynamically positioned at panel's bottom border with center alignment
  - Chevron down icon indicates collapsed state (click to show all items)
  - Chevron up icon indicates expanded state (click to collapse to 25 items)
  - Visible on filter panel hover or button hover (matches close button behavior)
  - Position updates automatically based on panel height and content changes
  - Toggle resets when switching categories or changing search query
  - Glass morphism styling with subtle hover effects matching panel design

### Changed
- **Filter System Architecture**: Clarified separation between genre sources
  - Genres filter category now always uses official genres from `album.genres`
  - Tags filter category uses non-official tags from `album.tags`
  - `useGenresOnly` preference now only controls album details panel display
  - `useGenresOnly` no longer affects filter panel categories (always uses correct source)
  - Updated genre-processor.ts documentation to reflect filter-specific usage
- **Filter Category Icons**: Updated filter category icons for better visual clarity
  - Record Labels now uses BiBuilding icon (was BiDisc)
  - Category dropdown reordered: Genres, Tags, Record Labels (bottom)
  - Dropdown width increased to 200px to accommodate "Record Labels" text on one line
- **Sort Dropdown Styling**: Updated sort dropdown menu to match filter panel category dropdown styling
  - Glass morphism: `bg-[#1A1A1A]/95` with `backdrop-blur-md`
  - Consistent borders: `border-white/10`
  - Enhanced hover effects: `hover:bg-white/[0.07]` for subtle but noticeable feedback
  - Selected state: `bg-white/10 text-white`
  - Smooth animations with fade-in and slide-in effects
  - Text size reduced to `text-sm` (14px) for consistency
  - Unified design language across all dropdown menus

## [0.9.5] Fixed streaming links not appearing instantly for cached albums

### Fixed
- **Streaming Links Instant Display**: Fixed streaming links not appearing instantly for cached albums
  - Implemented two-layer caching system for optimal performance
  - Layer 1 (localStorage): Album ID → streaming URL mapping eliminates 3+ MusicBrainz API calls
  - Layer 2 (IndexedDB): URL → platform links with 1-week TTL
  - Cached albums now display streaming links in <100ms (previously 6+ seconds)
  - Fixed broken failure detection logic that prevented cached `:failed` URLs from being recognized
  - 95%+ reduction in both MusicBrainz and Odesli API calls for repeat album views

## [0.9.4] - 2025-09-30

### Changed
- **Glass Morphism UI**: Complete redesign of header and active filters bar with frosted glass effects
  - Transparent header container allows album grid to extend throughout the page
  - All interactive elements (collection name, search, sort, filter, settings) use `backdrop-blur-md` with `bg-[#1A1A1A]/70`
  - Consistent pill-shaped design (`rounded-full`) for all header elements
  - Subtle borders: `border-white/10` default, `border-white/30` on hover
  - Enhanced text contrast: `text-white` for primary text, `text-white/70` for icons
  - ActiveFiltersBar now transparent with floating glass effect tags
  - Genre tags: `bg-primary/90` with hover to `bg-primary-light`
  - Label tags: `bg-rose-400/90` with hover to `bg-rose-300`
  - All tags include subtle shadow (`shadow-sm`) for depth
  - Immersive visual experience with album artwork visible behind UI elements

- **FilterPanel Redesign**: Modernized filter interface with inline expandable search
  - Minimalist category selector: no background, no chevron, hover effect scales icon/text 5%
  - Category dropdown with grey highlight (LuGuitar for genres, BiDisc for labels)
  - Inline expandable search (320px fixed width) with no native background
  - Search icon shows brighter background on hover only
  - Auto-collapse behavior: search closes when clicking outside if no text entered
  - Enhanced filter chips with brighter backgrounds (`bg-[#2A2A2A]/80`) and no borders
  - Improved close button positioning (12px offset from panel top)
  - Clean, consistent styling throughout

## [0.9.3] - 2025-09-30

### Added
- **Desktop App Support for Tidal and Apple Music**: New toggles to open streaming links in desktop applications
  - Settings → Streaming Services: "Open Tidal links in desktop app" toggle
  - Settings → Streaming Services: "Open Apple Music links in desktop app" toggle
  - URL transformation: Web URLs converted to app protocol URLs (`tidal://` and `music://`)
  - Supports multiple URL formats: `listen.tidal.com`, `geo.music.apple.com`, etc.
  - Matches existing Spotify desktop app functionality

### Fixed
- **Preference Migration**: New streaming preferences properly initialized for existing users
  - Added explicit field merging in `loadPreferences()` to handle new desktop app toggles
  - Existing user preferences preserved while new fields get default values

## [0.9.2] - 2025-09-30

### Changed
- **Floating Close Buttons**: AlbumDetailsPanel and FilterPanel now feature floating close buttons that remain visible during scroll
  - Fixed viewport positioning prevents button from scrolling with panel content
  - Responsive positioning: 44px offset on mobile/tablet, 24px on desktop (≥1024px)
  - Desktop auto-hide: Button hidden by default on large screens, appears on panel hover
  - Enhanced hover feedback: Scale animation (110%) and color transitions for better visual feedback
  - Improved mobile UX: Close button always accessible without scrolling back to top

## [0.9.1] - 2025-09-30

### Added
- **Dynamic Collection Name Display**: Header now displays actual MusicBrainz collection name instead of placeholder
  - Collection name fetched from MusicBrainz API during initial load
  - Stored in IndexedDB metadata for instant display on subsequent loads
  - Real-time updates via custom event system (no page reload required)
  - Early callback mechanism displays name immediately after metadata fetch (before all albums load)
  - Automatic migration for existing caches without collection names

### Fixed
- **Collection Name Persistence**: Collection name now properly persists when switching between collections
  - Collection name stored in IndexedDB `CollectionMetadata` structure
  - Automatic name clearing when collection ID changes
  - Cache properly associates collection name with collection ID

### Changed
- **Database Schema**: Enhanced `CollectionMetadata` interface with optional `name` field
- **Reactive Preferences**: `usePreferences` hook now listens for localStorage changes via custom events
- **API Data Flow**: `fetchAllReleaseGroupsInCollection` now returns collection name alongside release groups

## [0.9.0] - 2025-09-30

### Added
- **Persistent Streaming Links Cache**: Migrated from 24h memory cache to 1-week IndexedDB storage (STREAMING_LINKS_STORE)
- **Independent Background Fetching**: Streaming links load in parallel without blocking tracklist display
- **Failure Caching**: Invalid streaming URLs (400/404 errors) now cached to prevent repeated API calls
- **Conditional Animation**: Fade-in animation only applies to freshly fetched streaming links; cached links appear instantly

### Changed
- **Non-Blocking Architecture**: Tracklist displays immediately, streaming links fetch independently via useEffect
- **Client-Side Caching**: Server handles rate limiting only, all caching moved to IndexedDB
- **Database Version**: Upgraded to v6 with automatic migration
- **No Skeleton Loading**: Removed skeleton placeholders for streaming links for cleaner UX
- **Smart URL Testing**: Skips cached failed URLs immediately, eliminating 6+ second delays

### Fixed
- **Performance**: Eliminated 5-6 second blocking delay for tracklist display
- **UI Flash**: Streaming links now clear immediately when switching albums
- **Error Handling**: Cache failures fall back gracefully to API, ensuring links always display
- **SSR Safety**: Added client-side checks for IndexedDB operations
- **Cache Detection**: Streaming links now properly load from IndexedDB on subsequent album opens
- **Repeated Failures**: Albums with invalid streaming URLs no longer retry them on every open

### Breaking Changes
- Users must clear IndexedDB cache after upgrade (old cached data contains blocking behavior)

## [0.8.5] - 2025-09-30

### Changed
- **Interactive Album Cover**: Album cover art in details panel now links directly to MusicBrainz release-group page
- **Simplified UI**: Removed standalone "View on MusicBrainz" button in favor of clickable cover art
- **Enhanced UX**: Hover state on cover art shows MusicBrainz icon in bottom-right corner with tooltip

## [0.8.4] - 2025-09-30
- Add footer with Songlink attribution to StreamingLinksSection component

## [0.8.3] - 2025-09-28

### Improved
- **Album Cover Art Visual Enhancement**: Added subtle multi-layered shadow effect to album cover art in details panel for improved depth perception and visual prominence against dark backgrounds

## [0.8.2] - 2025-09-28

### Fixed
- **Skeleton Loading Flash**: Eliminated unnecessary skeleton loading indicators when album details data is already cached in IndexedDB
- **Progressive Loading UX**: Cached album data now displays immediately without loading flash, improving perceived performance

### Improved
- **Cache-First Loading Strategy**: Modified `fetchAlbumDetails` in useAlbums hook to check IndexedDB cache before setting loading state
- **Conditional Loading States**: Loading indicators now only appear when actually fetching data from network
- **Preserved Progressive Loading**: Individual component loading states (TrackList, StreamingLinks) continue to work independently for missing data

### Technical Changes
- Added `shouldShowLoading` flag to control when loading state should be displayed
- Moved cache availability check before `setSelectedAlbumLoading(true)` call
- Maintained all existing progressive loading functionality while eliminating unnecessary skeleton flash

## [0.8.1] - 2025-09-28

### Added
- **Centralized Preference Management**: New `usePreferences` hook for all user settings
- **Streaming Service Selector**: Individual toggles for 10 streaming platforms in configuration
- **Bulk Service Management**: "Select All" and "Select None" buttons for quick service management
- **Enhanced Configuration UI**: Organized sections for Display Settings, Streaming Services, and API Configuration
- **Automatic Preference Migration**: Seamless conversion from legacy localStorage structure
- **Type-Safe Preferences**: Comprehensive TypeScript interfaces for all preference categories

### Changed
- **useAlbums Hook**: Refactored to focus purely on album data, preferences moved to usePreferences
- **Configuration Page**: Reorganized with clear sections and improved user experience
- **Component Architecture**: Updated prop chains to use centralized preference system
- **localStorage Structure**: Migrated from multiple keys to single versioned preference object

### Technical Improvements
- **Separation of Concerns**: Clean division between data management and preference management
- **Migration Safety**: Automatic conversion with fallback to defaults for missing preferences
- **Performance**: Reduced localStorage operations through centralized management
- **Maintainability**: Easier to add new preferences with established patterns
- **Documentation**: Comprehensive updates across all documentation files

### Files Added
- `src/hooks/usePreferences.ts` - Centralized preference management hook
- `src/types/preferences.ts` - Type definitions for all preference categories
- `src/utils/preference-migration.ts` - Legacy preference migration utilities

### Files Modified
- `src/hooks/useAlbums.ts` - Refactored to use usePreferences
- `src/app/config/page.tsx` - Enhanced UI with streaming service selector
- `src/components/StreamingLinksSection.tsx` - Added service filtering based on preferences
- `src/components/AlbumDetailsPanel.tsx` - Updated to pass streaming preferences
- `src/app/page.tsx` - Updated to use new preference system

## [0.8.0-restored] - 2025-09-23

### Restored
- **Stable v0.8.0 Baseline**: Restored the app to a working v0.8.0 state
- **Core Functionality**: Label filtering system, genre filters, and basic collection display
- **Documentation Cleanup**: Removed references to non-implemented authentication features
- **Version Alignment**: Corrected package.json version to reflect actual feature set

### Removed (Temporarily)
- **Authentication System**: v0.9.0 authentication features removed for stability
- **Collection Switcher**: Multi-collection dropdown removed (was not fully implemented)
- **Private Collection Support**: Will be re-implemented in future versions

### Fixed
- **Release Groups API**: Ensured stable API access for public collections
- **Configuration Deprecation**: Updated Next.js image configuration warnings
- **App Stability**: Restored to last known working state without broken features

### Notes
- This version represents a stable baseline for future development
- All v0.8.0 features from the changelog below are confirmed working
- Authentication features will be properly implemented in future releases

## [0.8.0] - 2024-12-XX

### Added
- **Label Filter System**: Advanced dual-category filtering for record labels and genres
- **Tabbed Filter Interface**: Separate tabs for Genres and Labels in FilterPanel
- **AND/OR Logic**: Smart filtering logic - AND between categories, OR within same category
- **Clickable Labels**: Labels in album details panel are clickable to add as filters
- **Visual Distinction**: Purple accent for genres, rose accent for labels
- **Persistent State**: Label filter selections saved to localStorage

### Changed
- **FilterPanel**: Enhanced with tabbed interface for better organization
- **ActiveFiltersBar**: Updated to show both filter types with visual distinction
- **TrackList**: Made labels clickable with proper selection state handling

### Fixed
- **Label Filter Synchronization**: Fixed issue where selecting a label filter would show no results
- **Data Consistency**: Album details now properly sync label data back to main albums array
- **Filter Reliability**: Ensured label filtering works correctly for albums with loaded details

### Technical
- Created `label-processor.ts` utility for label extraction and filtering
- Added automatic duplicate removal for record labels within single releases
- Enhanced `useFilters` hook with label state management
- Updated filtering logic in `useAlbums` hook for AND/OR operations
- Complete prop chain implementation for label interaction
- Added `updateAlbumInList` helper to sync releaseDetails to main albums array
- Enhanced `fetchAlbumDetails` to maintain data consistency across UI components

## [0.7.3] - 2024-11-XX

### Added
- **Release Information Display**: Shows exact release date and labels below tracklist
- **Multi-Label Support**: Displays all associated record labels
- **Field Name Mapping**: Corrected interface for MusicBrainz API hyphenated fields

### Changed
- **TrackList Component**: Enhanced with release metadata display
- **API Integration**: Added `+labels` parameter to MusicBrainz release calls
- **Layout System**: Uses CSS flexbox for proper bottom alignment

### Fixed
- **Data Extraction**: Proper handling of `label-info` and `catalog-number` fields
- **Format Flexibility**: Handles partial dates and full dates with proper formatting

## [0.7.2] - 2024-10-XX

### Added
- **Multi-URL Testing**: Extracts and tests ALL streaming URLs from releases
- **Cross-Platform Testing**: Tests URLs from different platforms until success
- **User Preference Prioritization**: Tests preferred platforms first
- **Enhanced Success Rate**: Significantly improved streaming link discovery

### Changed
- **URL Discovery**: Complete rewrite of streaming URL discovery logic
- **Fallback Strategy**: Tests all URLs from primary release before fallbacks
- **Logging**: Detailed statistics tracking with emoji-tagged logs

### Technical
- `extractAllStreamingUrls()`: Extracts ALL streaming URLs from relationships
- `tryUrlsWithOdesli()`: Sequential testing with proper rate limiting
- `prioritizeUrls()`: Sorts URLs based on user preferences
- Rate limit compliance: 6-second delays between Odesli calls

## [0.7.1] - 2024-10-XX

### Added
- **Spotify Desktop App Integration**: Toggle to open Spotify links in desktop app
- **Smart URL Transformation**: Converts web URLs to `spotify://` protocol
- **Conditional UI**: Toggle appears only when Spotify is selected
- **Graceful Fallback**: Browser prompts for app installation if needed

### Technical
- URL transformation logic in `StreamingLinksSection` component
- Configuration state management through `useAlbums` hook
- Complete prop chain from configuration to streaming links
- Persistent setting stored in localStorage

## [0.7.0] - 2024-09-XX

### Added
- **Streaming Links Integration**: Automatic streaming platform discovery via Odesli API
- **MusicBrainz URL Extraction**: Intelligent extraction from release relationships
- **Platform Support**: Spotify, Apple Music, YouTube, Deezer, Tidal, SoundCloud, Bandcamp
- **User Preference Control**: Configure which platforms to display
- **Rate-Limited Fallback**: Tries multiple releases with proper delays
- **Visual Integration**: Clean icon-based display in album details

### Technical
- Rate limiting compliance: 2-second delays between MusicBrainz requests
- Odesli rate limiting: 6-second minimum between API calls
- 24-hour TTL for Odesli responses
- Non-blocking background fetching
- Multiple fallback strategies

## [0.6.4] - 2024-08-XX

### Added
- **Genre Popularity Sorting**: Genres sorted by vote count from MusicBrainz API
- **Enhanced Type System**: New `Genre` and `Tag` interfaces with vote counts
- **Dual Format Support**: Handles both string arrays and object arrays
- **Smart Data Handling**: Keeps highest-voted entries when duplicates exist

### Changed
- **Data Normalization**: Preserves vote counts from API responses
- **Genre Display**: Most popular genres appear first in album details
- **Backward Compatibility**: Seamlessly handles old cached data

### Technical
- Updated `ReleaseGroup` interface for both string and object formats
- Enhanced `AlbumDetailsPanel` with popularity sorting
- Modified `normalize-mb-data.ts` to preserve API vote data

## [0.6.3] - 2024-08-XX

### Added
- **Automatic Panel Management**: Panels automatically close each other
- **Smart Coordination**: Filter panel and album details panel coordination
- **Enhanced Mobile UX**: Better screen space utilization on small devices

### Changed
- **Panel Workflow**: Seamless switching between filtering and viewing details
- **State Management**: Intelligent coordination between panel states
- **Filter Persistence**: Active filters remain when panels close

### Technical
- Enhanced `toggleFilterPanel` handler to close album details
- Modified album selection effect to close filter panel
- Coordinated state management between boolean states

## [0.6.2] - 2024-08-XX

### Added
- **Search Privacy**: Disabled browser autocomplete suggestions
- **Enhanced Privacy**: Search terms no longer stored in browser history
- **Header Integration**: Search clears when clicking header title

### Changed
- **Cleaner Interface**: Eliminates unwanted dropdown suggestions
- **Better UX**: No browser interference with search functionality

### Technical
- Added `autoComplete="off"` to search input
- Enhanced `handleTitleClick` to include search clearing

## [0.6.1] - 2024-08-XX

### Added
- **Clickable Header Title**: Quick UI reset by clicking collection name
- **Smart Panel Management**: Closes all panels with single click
- **Smooth Scroll**: Returns to top with smooth animation
- **Visual Feedback**: Hover effects and cursor pointer
- **Filter Preservation**: Active filters remain intact

### Technical
- Click handler with hover states in Header component
- Ref-based control for external dropdown management
- Coordinated panel state management across components

## [0.6.0] - 2024-07-XX

### Added
- **ActiveFiltersBar Component**: Persistent bar showing active filters
- **Clear-All Functionality**: BiX icon button to clear all filters
- **Visual Hierarchy**: Proper z-index stacking prevents overlaps
- **Streamlined Controls**: Removed chevron arrows, using highlight colors

### Changed
- **Filter UI**: Purple accent for active filter count badge
- **User Experience**: Single-click to remove filters, no X icons on tags
- **Visual Design**: Consistent shadows using main background color
- **Performance**: Solid backgrounds instead of blur effects

### Technical
- Added `hasActiveFilters` prop to AlbumDetailsPanel
- Enhanced shadow effects across components
- Streamlined architecture with BiX icon from react-icons/bi

## [0.5.2] - 2024-07-XX

### Added
- **Proper Genre Capitalization**: Using Tailwind CSS `capitalize` utility
- **Visual Consistency**: "Rock" instead of "rock", "Hip Hop" instead of "hip hop"
- **Clean Implementation**: Uses built-in Tailwind utility

### Changed
- **Data Preservation**: Underlying data unchanged, only visual display enhanced
- **Consistent Experience**: Applied to all genre display locations

### Technical
- Added `capitalize` class to FilterPanel and AlbumDetailsPanel
- No changes to filtering logic or data storage

## [0.5.1] - 2024-06-XX

### Fixed
- **Release Type Preservation**: Secondary types no longer disappear after loading
- **Data Merging**: Enhanced fetchAlbumDetails to preserve existing data
- **Improved Reliability**: Consistent display of all release type information

### Technical
- Modified `fetchAlbumDetails` to use data merging pattern
- Spread operator strategy: `{...existingAlbum, ...details}`
- Maintained backward compatibility with non-collection albums

## [0.5.0] - 2024-06-XX

### Added
- **Genre/Tag Separation**: Distinction between official genres and user tags
- **Configuration Control**: "Use only official genres" toggle
- **API Enhancement**: Fetches both genres and tags separately
- **Cleaner Filtering**: Official genres exclude non-musical tags
- **User Choice**: Toggle between official genres and all tags

### Changed
- **Data Model**: Added separate `genres` and `tags` fields
- **Album Details**: Respects genre vs tag preference setting
- **Filter Logic**: Enhanced to support both modes

### Technical
- Updated genre-processor utility with `useGenresOnly` parameter
- Enhanced AlbumDetailsPanel to respect configuration
- Modified useAlbums hook for configuration support

## [0.4.3] - 2024-05-XX

### Changed
- **Sort Labels**: "Release Date Old-New" → "Release: Oldest"
- **Sort Labels**: "Release Date New-Old" → "Release: Newest"
- **Z-Index Fix**: Header z-30, dropdown z-50 for proper layering
- **Better UX**: Sort dropdown overlays all elements correctly

### Technical
- Updated sortOptions labels in SortDropdown component
- Fixed stacking context issues
- Maintained localStorage compatibility

## [0.4.2] - 2024-05-XX

### Added
- **Three-Tier Responsive Layout**: Mobile, tablet, and desktop breakpoints
- **Mobile Scrolling Enhancement**: Proper height constraints
- **Header Integration**: CSS variables for dynamic header heights
- **Touch Optimization**: Enhanced mobile and tablet interactions

### Changed
- **Tablet Layout**: Cover art and metadata side-by-side, tracklist below
- **Mobile Layout**: Left-aligned cover art for natural flow
- **Viewport Optimization**: Smart height calculation

### Technical
- Dynamic height: `calc(100vh-var(--header-height)-2rem)`
- Responsive breakpoints aligned with Tailwind standards
- Conditional overflow handling based on screen size

## [0.4.1] - 2024-04-XX

### Added
- **Unified Icon System**: Migration to react-icons/bi (Boxicons)
- **Collection Mode Indicator**: BiCollection icon
- **Consistent Sizing**: 24px desktop, 20px mobile
- **Icon Inventory**: BiCollection, BiCog, BiSort, BiFilter, BiChevronDown

### Changed
- **Design Cohesion**: All icons from same visual language
- **Better Scalability**: React components scale properly
- **Easier Maintenance**: Single icon library source
- **Visual Hierarchy**: Larger, more prominent icons

### Technical
- Replaced SVG markup with React components
- Improved accessibility with semantic markup
- Enhanced maintainability with centralized management

## [0.3.1] - 2024-04-XX

### Added
- **Progressive Loading**: Basic album info displays immediately
- **TrackList Component**: Dedicated component for track listings
- **Loading States**: Separate states for basic vs detailed info
- **Data Validation**: Numeric validation for durations and counts

### Fixed
- **NaN Display Issues**: Enhanced validation in components
- **Background Loading**: Tracklist loads asynchronously
- **User Experience**: Instant cover art, title, artist display

### Technical
- Separate loading states for basic details vs tracklist
- All duration calculations validate for finite numbers
- Background tracklist loading with dedicated states

## [0.3.0] - 2024-03-XX

### Added
- **Sort Feature**: Six sorting options (Artist A-Z/Z-A, Title A-Z/Z-A, Release: Oldest/Newest)
- **Persistent Preferences**: Sort selection saved to localStorage
- **Smart Integration**: Sort dropdown in header
- **Default Sort**: Release: Oldest for chronological browsing
- **Search Compatibility**: Sorting works with search filtering

### Technical
- SortDropdown component with six options
- Sorting logic in useAlbums hook with memoization
- Header integration for desktop and mobile
- localStorage persistence

## [0.2.1] - 2024-03-XX

### Added
- **Collection Name Display**: Automatically fetches MusicBrainz collection name
- **Layout Option C**: Compact header design
- **Responsive Design**: Separate mobile/desktop layouts
- **Configuration Page**: Sync status moved from header

### Changed
- **Cleaner Header**: Streamlined navigation
- **Visual Hierarchy**: Improved information organization
- **Information Flow**: Better structured layout

### Technical
- Automatic collection name fetching
- CSS variables for responsive design
- Configuration page enhancement

## [0.2.0] - 2024-02-XX

### Added
- **Client-Side Caching**: IndexedDB for MusicBrainz responses
- **Progressive Loading**: Essential metadata loads first
- **Cache Status**: Last updated time and sync indicators
- **Background Updates**: Cache updates without blocking UI

### Changed
- **Data Strategy**: Immediate cached data display
- **Loading Pattern**: Prioritized visible content
- **Fallback Mechanism**: Memory cache and sample data

### Technical
- Complete IndexedDB integration
- Background refresh mechanism
- Skeleton placeholders during loading
- Graceful degradation when offline

## [0.1.3] - 2024-01-XX

### Added
- **Image Optimization**: Custom API for resizing and WebP conversion
- **Disk Caching**: Optimized images cached for performance
- **Progressive Loading**: Color-based placeholders
- **Performance Monitoring**: Loading time tracking

### Technical
- Custom `/api/image` route for optimization
- WebP conversion for smaller file sizes
- Smooth transition from placeholder to image
- Fallback handling for missing images

## [0.1.0] - 2024-01-XX

### Added
- **Initial Release**: Music Library Viewer
- **MusicBrainz Integration**: Collection display
- **Album Grid**: Responsive layout with cover art
- **Search Functionality**: Real-time filtering
- **Album Details**: Expandable detail panels
- **Dark Theme**: Modern dark UI with violet accents

### Technical
- Next.js 14 with TypeScript
- Tailwind CSS for styling
- React hooks for state management
- MusicBrainz API integration