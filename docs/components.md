# Component Guide

This document provides detailed information about the React components used in the Music Library Viewer application.

**Last Updated:** v0.13.1 (2025-10-12)

## Core Layout Components

### Header (src/components/Header.tsx)

The main navigation component featuring a compact design with responsive layout and integrated authentication.

**Features:**
- **Layout Option C**: Compact design with collection icon, collection name, authentication status, search, sort, and settings
- **Universal Menu Button**: Menu icon (hamburger) available across all screen sizes (v0.12.2+)
  - **Desktop/Tablet**: `[Menu] [Collection Icon] [Collection Name] | [search] | [sort] | [filter] | [settings]`
    - Menu button appears on left side next to collection name
    - Collection name remains visible in header
    - Menu dropdown shows authentication section and Settings link
  - **Mobile**: Single-row compact layout `[Menu] [search] [sort] [filter]`
    - Menu dropdown shows collection name button, authentication section, and Settings link
    - Collection name hidden behind menu for compact layout
  - **Menu Toggle**: BiMenu icon changes to BiX when open, auto-closes after navigation
  - **Consistent Styling**: Glass morphism design across all breakpoints
- **Authentication Integration** (v0.12.3+):
  - **Authenticated State**: Shows BiUserCheck icon + "Logged in as USERNAME" + Logout button
    - Username is clickable link to MusicBrainz profile (opens in new tab)
    - BiLinkExternal indicator next to username
    - Logout button on same row with BiLogOut icon
  - **Unauthenticated State**: Shows BiUserX icon + "Login with MusicBrainz.org"
    - BiLinkExternal indicator shows external redirect
  - **Auto-detection**: Uses `useAuth` hook to detect login status
  - **Menu Placement**: Auth section appears between collection name (mobile) and Settings link
  - **Visual Indicators**:
    - BiUserCheck icon in primary color (violet) when logged in
    - BiLogOut icon (16px) for logout action
    - BiUserX icon in white/70 when not logged in
    - BiLinkExternal icons (12px) for external links
  - **OAuth Flow**: Login button redirects to MusicBrainz OAuth, logout revokes tokens
  - **Toast Notifications**: Success/error messages appear in top-right corner
    - Login success: "Successfully logged in as USERNAME!" (green, 3s)
    - Logout success: "Successfully logged out!" (green, 3s)
    - Login error: "Login failed: {error}" (red, 5s)
    - Smooth fade-in animation with auto-dismiss
- **Browse Collections** (v0.13.0+):
  - Menu item always visible (grayed out when not authenticated)
  - Toggles CollectionBrowsePanel instead of navigating
  - Positioned between authentication section and Settings
- **Collection Icon**: BiCollection icon from react-icons/bi indicates collection mode (24px desktop, 20px mobile)
- **Dynamic Collection Name**:
  - Displays actual MusicBrainz collection name fetched from API
  - Shows "Music Collection" placeholder until name is loaded
  - Real-time updates via custom event system (no page reload needed)
  - Name appears immediately after metadata fetch (before all albums load)
  - Persists in IndexedDB for instant display on subsequent loads
- **Clickable Title**: Collection name/title is clickable to close all panels, clear search bar, and scroll to top (preserves active filters)

**Props:**
- `collectionName`: String - The name of the MusicBrainz collection (from usePreferences hook)
- `collectionId`: String - The collection ID (for identification purposes)
- `onTitleClick`: Function - Handler for title click events
- `searchTerm`: String - Current search term
- `onSearchChange`: Function - Search input change handler
- `isCollectionsPanelOpen`: Boolean - Collections panel state (v0.13.0+)
- `toggleCollectionsPanel`: Function - Toggle collections panel (v0.13.0+)
- Additional props for sort, filter, and settings interactions

**Data Flow:**
1. Component receives `collectionName` from `useAlbums` → `usePreferences` hook
2. Progressive loader fetches collection name from API or IndexedDB cache
3. Custom event `mb-preferences-updated` triggers preference reload
4. Header component re-renders with updated collection name

**Styling:**
- Transparent header with glass morphism effects on individual elements
- **Dark gradient overlay**: Multi-stop linear gradient (`rgba(18, 18, 18, 0.95) → transparent`) with 9 color stops for smooth, fluid fade effect
  - Extends below header content to create fade zone for scrolling albums
  - Improves icon visibility when album grid scrolls behind header
  - Carefully tuned opacity stops prevent harsh transitions
- All interactive elements use `backdrop-blur-md` with `bg-[#1A1A1A]/70` for consistent frosted glass appearance
- Collection name button: Fully rounded pill shape (`rounded-full`) with glass effect, no border
- Sort/Filter/Settings buttons: Fully rounded (`rounded-full`) with glass effect and subtle borders
- Search bar: Pill-shaped with glass effect and hover/focus states
- Borders: `border-white/10` default, `border-white/30` on hover
- Sticky positioning with proper z-index layering
- **CSS variables for dynamic header heights**:
  - Desktop: 64px (`--header-height`)
  - Mobile: 56px (reduced from 96px for compact single-row layout)

### AlbumCard (src/components/AlbumCard.tsx)

Individual album card component displayed in the grid.

**Features:**
- Album cover image with fallback
- Artist and album name with truncation
- Hover effects and selection states
- Responsive sizing based on viewport

**Props:**
- `album`: Object - Album data object
- `isSelected`: Boolean - Selection state
- `onClick`: Function - Click handler

## Specialized Components

### CollectionBrowsePanel (src/components/CollectionBrowsePanel.tsx) - v0.13.0-0.13.1

Collapsible panel component for browsing and switching between user's MusicBrainz collections.

**Features:**
- Collapsible panel similar to AlbumDetailsPanel and FilterPanel
- Stacked list layout displaying all release-group collections
- **Clickable Collection Cards** (v0.13.1): Entire card is click target for instant loading
- **Manual Collection Input** (v0.13.1): Input field for loading by ID or URL
  - Real-time validation with visual feedback (green checkmark, red error, spinner)
  - Auto-extraction of MBID from full MusicBrainz URLs
  - Auto-dismissing toast notifications (3s success, 5s error)
  - Enter key support and clear button (X icon)
  - Load button appears when validation passes
- Visual "Current" badge for currently loaded collection
- Authentication-gated (shows login prompt for unauthenticated users)
- Loading, error, and empty states
- Sticky positioning with hover-visible close button
- Glass morphism styling matching other panels

**Props:**
- `isOpen`: Boolean - Panel open/close state
- `onClose`: Function - Close panel callback
- `username`: String | null - MusicBrainz username (from auth state)
- `currentCollectionId`: String - ID of currently loaded collection
- `onLoadCollection`: Function - Callback when user loads a collection (receives collectionId, collectionName)
- `isAuthenticated`: Boolean - Authentication status
- `hasActiveFilters`: Boolean - Whether active filters bar is visible (affects panel positioning)

**Layout:**
- Sticky container positioned below header
- Floating close button (hover-visible on desktop, always visible on mobile)
- **Grouped Collections** (v0.13.1): "My Collections" and "Collaborative Collections" sections
- **Manual Input** (v0.13.1): Input field in header area with validation icons and Load button
- Panel content with scrollable list of collections
- Each collection card shows (v0.13.1 design):
  - Collection name (bold, left side)
  - Editor name and album count (bullet separator)
  - "Current" badge with BiCheck icon (if currently loaded)
  - "View on MusicBrainz.org" button (right side, external link icon)
  - **Entire card is clickable** for loading (except current collection)
  - Hover effect: `bg-white/[0.02]` on loadable cards

**Styling:**
- Sticky positioning: `top: var(--header-height, 64px)` (adjusts for active filters)
- Background: `linear-gradient(180deg, rgba(26,26,26,0.98) 0%, rgba(26,26,26,0.95) 100%)`
- Backdrop filter: `blur(8px) saturate(1.2)`
- Border: `border-white/10`, rounded-3xl corners
- Card dividers: `border-b border-white/5`
- Current collection badge: `bg-primary/20 text-primary` with rounded-full shape
- Manual input: 280px width, dark bg (`bg-[#2A2A2A]`), rounded-lg

**User Flow:**
1. Click "Browse Collections" in header menu (opens panel)
2. Panel slides in below header
3. **Option A - Collection Cards**: Click any card to load instantly (v0.13.1)
4. **Option B - Manual Input**: Enter collection ID/URL, validate, click Load (v0.13.1)
5. Panel closes automatically, albums refresh with new collection
6. Click close button or click elsewhere to close panel

**Known Issues (v0.13.1):**
- Manual collection input has race condition, requires page reload to display albums
- Collection card loading works correctly

**Integration:**
- Integrated into main page component (`src/app/page.tsx`)
- Uses `/api/musicbrainz/collections` endpoint
- Validation via `/utils/mbid-validation.ts`
- Updates preferences via `onLoadCollection` callback
- Panel state managed by parent page component
- Mutually exclusive with Album Details and Filter panels

### CoverArtImage (src/components/CoverArtImage.tsx)

Specialized image component for handling MusicBrainz cover art with optimization.

**Features:**
- Handles URL transformations for the CoverArt API
- Provides fallback for missing images
- Manages loading states and errors
- Integrates with custom image optimization API

**Props:**
- `src`: String - Image source URL
- `alt`: String - Alt text for accessibility
- `size`: Number - Desired image dimensions
- `className`: String - Additional CSS classes

### SearchBar (src/components/SearchBar.tsx)

Search functionality component with enhanced UX features and glass morphism styling.

**Features:**
- Real-time search with debouncing
- Enhanced privacy with `autoComplete="off"`
- Visual feedback for active search states
- Responsive design with proper sizing
- Glass effect with `backdrop-blur-md` and semi-transparent background
- Dynamic placeholder text based on viewport size (3-tier responsive system)
- Search icon positioned with `z-10` to prevent blur artifacts
- Pill-shaped design with subtle borders

**Styling:**
- Background: `bg-[#1A1A1A]/70` with backdrop blur
- Borders: `border-white/10` default, `border-white/30` on hover
- Text: `text-white` with `placeholder:text-white/50`
- Icon: `text-white/70` for consistent contrast

**Props:**
- `value`: String - Current search value
- `onChange`: Function - Search change handler
- `placeholder`: String - Placeholder text

## Filter System Components

### FilterButton (src/components/FilterButton.tsx)

Button component that toggles the filter panel visibility.

**Features:**
- Shows active filter count badge
- Visual feedback for panel state
- Responsive sizing
- Icon-based design with BiFilter icon

**Props:**
- `isFilterPanelOpen`: Boolean - Current panel state
- `toggleFilterPanel`: Function - Toggle handler
- `activeFilterCount`: Number - Number of active filters
- `hasActiveFilters`: Boolean - Whether any filters are active

### RatingFilterSection (src/components/RatingFilterSection.tsx)

Rating range filter component with double slider for filtering albums by MusicBrainz ratings.

**Features:**
- Double range slider (0-5 stars, step: 0.5)
- Manual input fields for precise min/max values
- Star icons at slider ends (empty star ☆ at 0, filled star ★ at 5)
- Visual design matching DateFilterSection
- Amber/yellow color theme (matches star rating colors)
- Clear filter button
- Real-time filter updates

**Props:**
- `ratingRange`: `{ min: number; max: number } | null` - Current rating range (null = no filter)
- `setRatingRange`: Function - Update rating range callback
- `onClose`: Function - Close filter panel callback

**Styling:**
- Slider track: `bg-gray-700` (inactive), `bg-amber-400` (active range)
- Thumbs: `bg-amber-400` with `border-amber-300` and hover effects
- Input fields: Dark background (`bg-[#2A2A2A]`) with hover brightening
- Star icons: `BiStar` from react-icons/bi
- Color theme: Amber-400 for consistency with star rating display

**User Interaction:**
- Drag slider thumbs to set range
- Type values directly in input fields (validates on blur/enter)
- Click "Clear Filter" to reset range
- Smart overlapping behavior when min === max (dynamic z-index for independent control)

**Integration:**
- Used in FilterPanel component as 'rating' category
- Filter persisted to localStorage via useFilters hook
- Updates ActiveFiltersBar with amber-colored chip

## Detail Components

### StarRating (src/components/StarRating.tsx)

5-star rating display component with fractional rendering for MusicBrainz ratings.

**Features:**
- Converts 0-100 MusicBrainz rating scale to 0-5 stars
- Fractional star rendering (e.g., 3.7 stars shows 3 full + 1 partial)
- Vote count display for average ratings
- Personal rating indicator "(You)" for user's own ratings
- Empty state handling
- Multiple size variants (sm, md, lg)
- Tooltip with exact rating value

**Props:**
- `rating`: `number | null` - Rating in 0-100 scale (MusicBrainz format)
- `mode`: `'average' | 'personal'` - Display mode
- `count`: `number` (optional) - Vote count (shown for average ratings)
- `size`: `'sm' | 'md' | 'lg'` (optional, default: 'md') - Size variant
- `className`: `string` (optional) - Additional CSS classes

**Visual Examples:**
```
Average mode:
★★★★☆ 4.2 (127 ratings)

Personal mode with rating:
★★★★★ 5.0 (You)

Personal mode without rating:
Not rated yet

No rating data:
No ratings
```

**Styling:**
- Filled stars: `text-yellow-400` (BiStar icon)
- Empty stars: `text-gray-600` (BiStar icon)
- Count text: `text-text-tertiary text-sm`
- Personal indicator: `text-primary text-sm font-medium`
- Size variants:
  - sm: 14px font size, 2px gap
  - md: 18px font size, 4px gap (default for AlbumDetailsPanel)
  - lg: 24px font size, 6px gap

**Integration:**
- Used in AlbumDetailsPanel to display album ratings
- Respects `showRatings` and `ratingDisplayMode` preferences
- Handles authentication states for personal ratings
- Shows auth requirement message when not logged in (personal mode)

**Rating Conversion:**
```typescript
// MusicBrainz API: 0-100 → Display: 0-5 stars
const stars = rating / 20;
// Example: 85 → 4.25 stars (★★★★¼)
```

## Utility Components

## Component Architecture Patterns
