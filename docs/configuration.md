# Configuration Guide

This document covers the dynamic configuration system that allows users to set up their MusicBrainz collection and customize application behavior through a web interface.

## Overview

The Music Library Viewer uses a dynamic configuration system that stores settings in browser localStorage, allowing users to configure their collections without touching source code. This approach enables multi-user support, easy collection switching, and immediate effect of changes.

## Configuration Interface

### Settings Page (src/app/config/page.tsx)

The main settings interface provides:

- **Display Settings**: Genre/tag display control, theme preferences, and rating display options
- **Streaming Services**: Individual toggles for streaming platforms with bulk actions
- **Desktop App Integration**: Configure Spotify, Tidal, and Apple Music to open in desktop apps
- **Rating Display**: Toggle ratings and select between community average or personal ratings
- **Preference Persistence**: Configuration managed by `usePreferences` hook with automatic migration
- **Real-Time Application**: Changes take effect immediately after saving
- **Advanced Options** (dev mode): User Agent configuration, caching, and error logging toggles

### Collection Management (Browse Collections Panel)

Collection switching is handled through the Browse Collections panel (accessible via header menu):

- **Browse Collections Panel** (src/components/CollectionBrowsePanel.tsx): Primary interface for collection management
  - **Collection List**: Shows all user's release-group collections with metadata
  - **Manual Input**: Accepts both collection IDs and full MusicBrainz URLs
  - **Real-time Validation**: Validates collection type and accessibility as you type (800ms debounce)
  - **Visual Feedback**: Green checkmark for valid, error icon with message for invalid input
  - **URL Extraction**: Automatically extracts MBID from URLs (e.g., `https://musicbrainz.org/collection/YOUR-ID`)
  - **Seamless Loading**: Collections load without page refresh via direct prop passing
  - **Current Collection**: Visual indicator shows which collection is currently loaded

## Configuration Flow

### First-Time Setup

1. **Login**: Click the menu button (☰) in the header → "Login with MusicBrainz.org"
2. **Authenticate**: Grant permissions on MusicBrainz.org
3. **Browse Collections**: Click menu (☰) → "Browse Collections"
4. **Select Collection**:
   - **From List**: Click any collection card to load it instantly
   - **Manual Entry**: Enter a collection ID or URL in the input field
5. **Automatic Loading**: Collection loads without page refresh

### Ongoing Management

1. **Switch Collections**: Use Browse Collections panel anytime to switch between collections
2. **Persistent Storage**: Active collection saved to localStorage and restored on app launch
3. **Settings Changes**: Use Settings page (menu → Settings) to adjust display and streaming preferences
4. **Live Updates**: All changes applied immediately without page refresh

## Preference Management System

### Architecture

The application uses a centralized preference management system built on the `usePreferences` hook:

- **Single Source of Truth**: All preferences managed in one location
- **Automatic Migration**: Legacy localStorage keys automatically converted
- **Type Safety**: Full TypeScript support with validation
- **Category Organization**: Preferences grouped by domain (display, streaming, api, metadata)
- **Immediate Updates**: Changes propagate throughout app without restart

### Storage Structure

```json
{
  "version": 1,
  "display": {
    "sortOption": "artist-asc",
    "useGenresOnly": true,
    "theme": "dark"
  },
  "streaming": {
    "spotifyUseDesktopApp": false,
    "tidalUseDesktopApp": false,
    "appleMusicUseDesktopApp": false,
    "enabledServices": {
      "spotify": true,
      "appleMusic": true,
      "youtube": true,
      "youtubeMusic": true,
      "amazon": true,
      "amazonMusic": true,
      "deezer": true,
      "tidal": true,
      "soundcloud": true,
      "pandora": true
    }
  },
  "api": {
    "collectionId": "",
    "userAgent": "MusicLibraryViewer/1.0.0 (mailto:contact@example.com)",
    "useDirectApi": false,
    "enableCaching": true,
    "logErrors": true
  },
  "metadata": {
    "collectionName": "",
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  }
}
```

## Configuration Options

### Required Settings

#### collectionId
- **Type**: String (UUID format)
- **Required**: Yes
- **Path**: `preferences.api.collectionId`
- **Description**: MusicBrainz collection UUID (required for app functionality)
- **Example**: `"12345678-1234-5678-9012-123456789012"`
- **Input Formats**:
  - Direct MBID: `27a3c068-3ec5-421a-ad12-599d085fdeb1`
  - Full URL: `https://musicbrainz.org/collection/27a3c068-3ec5-421a-ad12-599d085fdeb1`
- **Validation**:
  - **Format Check**: Must be a valid UUID format (8-4-4-4-12 hexadecimal)
  - **API Validation**: Checks that collection exists and is accessible
  - **Type Check**: Verifies collection contains release-groups (not releases, artists, etc.)
  - **Auto-extraction**: Automatically extracts MBID from MusicBrainz URLs
  - **Debounced**: Validation runs 800ms after user stops typing
- **Visual Feedback**:
  - 🔵 Spinner: Validating collection
  - ✅ Green checkmark: Valid release-group collection
  - ❌ Red error icon: Invalid collection with helpful error message

#### userAgent
- **Type**: String
- **Required**: Yes
- **Path**: `preferences.api.userAgent`
- **Description**: Custom User-Agent string respecting MusicBrainz API guidelines
- **Example**: `"MyMusicApp/1.0 (contact@example.com)"`
- **Guidelines**: Must include app name, version, and contact information

### API Configuration

#### useDirectApi
- **Type**: Boolean
- **Default**: `false`
- **Path**: `preferences.api.useDirectApi`
- **Description**: Direct API access toggle (disabled by default for CORS compatibility)
- **Note**: Most users should keep this disabled

#### enableCaching
- **Type**: Boolean
- **Default**: `true`
- **Path**: `preferences.api.enableCaching`
- **Description**: Toggle IndexedDB caching system
- **Impact**: Disabling reduces performance and offline functionality

#### logErrors
- **Type**: Boolean
- **Default**: `false`
- **Path**: `preferences.api.logErrors`
- **Description**: Enable detailed error logging for debugging
- **Use Case**: Helpful for troubleshooting API issues

### Display Configuration

#### useGenresOnly
- **Type**: Boolean
- **Default**: `true`
- **Path**: `preferences.display.useGenresOnly`
- **Description**: Use only official MusicBrainz genres (true) or all tags as genres (false)
- **Impact**:
  - `true`: Shows curated, musical genres only
  - `false`: Shows all user-submitted tags including non-musical ones

#### sortOption
- **Type**: String (enum)
- **Default**: `"artist-asc"`
- **Path**: `preferences.display.sortOption`
- **Options**: `artist-asc`, `artist-desc`, `title-asc`, `title-desc`, `date-old-new`, `date-new-old`
- **Description**: Default sort order for album display

## Streaming Service Configuration

The streaming service selector allows users to customize which streaming platforms are displayed in album details. This feature provides granular control over the streaming integration interface.

### User Interface

The streaming services configuration includes:

1. **Individual Service Toggles**: Checkbox for each supported platform
2. **Bulk Actions**: "Select All" and "Select None" buttons for quick management
3. **Real-time Updates**: Changes apply immediately to album detail views
4. **Visual Feedback**: Clear indication of enabled/disabled services

### Supported Services

| Service | Key | Default | Description |
|---------|-----|---------|-------------|
| Spotify | `spotify` | `true` | World's largest music streaming platform |
| Apple Music | `appleMusic` | `true` | Apple's music streaming service |
| YouTube | `youtube` | `true` | Google's video platform with music content |
| YouTube Music | `youtubeMusic` | `true` | Google's dedicated music streaming service |
| Amazon | `amazon` | `true` | Amazon's music purchase platform |
| Amazon Music | `amazonMusic` | `true` | Amazon's music streaming service |
| Deezer | `deezer` | `true` | French music streaming platform |
| Tidal | `tidal` | `true` | High-fidelity music streaming service |
| SoundCloud | `soundcloud` | `true` | Audio distribution platform |
| Pandora | `pandora` | `true` | Internet radio and music streaming service |

### Configuration Behavior

- **Enabled Services**: Show streaming icons in album details panels
- **Disabled Services**: Hidden from album details, no API calls made
- **Desktop App Toggles**: Separate toggles for Spotify, Tidal, and Apple Music to open links in desktop apps
- **Persistence**: Settings saved automatically and persist across sessions
- **Migration**: Legacy preferences automatically converted to new structure

### Genre and Tag Settings

#### useGenresOnly
- **Type**: Boolean
- **Default**: `true`
- **Description**: Use only official MusicBrainz genres (true) or all tags as genres (false)
- **Impact**:
  - `true`: Shows curated, musical genres only
  - `false`: Shows all user-submitted tags including non-musical ones

### Streaming Integration

#### spotifyUseDesktopApp
- **Type**: Boolean
- **Default**: `false`
- **Description**: Open Spotify links in desktop app instead of web browser
- **Path**: `preferences.streaming.spotifyUseDesktopApp`

#### enabledStreamingServices
- **Type**: Object
- **Default**: All services enabled
- **Description**: Individual toggles for streaming service display
- **Path**: `preferences.streaming.enabledServices`
- **Services**: spotify, appleMusic, youtube, youtubeMusic, amazon, amazonMusic, deezer, tidal, soundcloud, pandora
- **UI Features**:
  - Individual checkboxes for each service
  - "Select All" and "Select None" bulk actions
  - Real-time filtering in album details

#### enableStreamingLinks
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable streaming platform link discovery and display
- **Dependencies**: Requires Odesli API integration

#### preferredStreamingPlatforms
- **Type**: Array of strings
- **Default**: `['spotify', 'appleMusic', 'youtube', 'deezer']`
- **Description**: Array of preferred streaming platforms
- **Available Options**:
  - `'spotify'`
  - `'appleMusic'`
  - `'youtube'`
  - `'youtubeMusic'`
  - `'deezer'`
  - `'tidal'`
  - `'soundcloud'`
  - `'bandcamp'`
  - `'pandora'`

#### Desktop App Integration

##### spotifyUseDesktopApp
- **Type**: Boolean
- **Default**: `false`
- **Description**: Open Spotify links in desktop app instead of web browser
- **Requirements**: Spotify desktop app must be installed
- **Behavior**: Converts `https://open.spotify.com/` URLs to `spotify://` protocol

##### tidalUseDesktopApp
- **Type**: Boolean
- **Default**: `false`
- **Description**: Open Tidal links in desktop app instead of web browser
- **Requirements**: Tidal desktop app must be installed
- **Behavior**: Converts Tidal web URLs (e.g., `https://listen.tidal.com/`) to `tidal://` protocol
- **Supported URLs**: `tidal.com`, `listen.tidal.com`, `www.tidal.com`

##### appleMusicUseDesktopApp
- **Type**: Boolean
- **Default**: `false`
- **Description**: Open Apple Music links in desktop app instead of web browser
- **Requirements**: Apple Music app must be installed (macOS/iOS)
- **Behavior**: Converts Apple Music web URLs to `music://` protocol
- **Supported URLs**: `music.apple.com`, `geo.music.apple.com`

#### odesliApiKey
- **Type**: String (optional)
- **Default**: `undefined`
- **Description**: Optional Odesli API key for higher rate limits
- **Benefits**: Increases rate limits from 10 to higher tiers
- **Note**: API works without key but with lower limits

## Authentication Configuration

### MusicBrainz Authentication

The application supports secure MusicBrainz authentication to access private collections and all user collections.

#### Authentication Settings

##### username
- **Type**: String
- **Required**: For private collection access
- **Description**: MusicBrainz username for authenticated requests
- **Security**: Never stored in plaintext; always encrypted before storage

##### password
- **Type**: String
- **Required**: For private collection access
- **Description**: MusicBrainz password for authenticated requests
- **Security**: Encrypted with AES-256-GCM before storage

##### storageType
- **Type**: String enum
- **Options**: `'session'`, `'memory'`, `'local'`
- **Default**: `'session'`
- **Description**: Determines where encrypted credentials are stored
- **Behavior**:
  - `'session'`: Credentials persist until browser tab closes
  - `'memory'`: Credentials cleared on page refresh
  - `'local'`: Credentials persist across browser sessions

##### timeout
- **Type**: Number (milliseconds)
- **Default**: `1800000` (30 minutes)
- **Description**: Auto-logout inactivity timeout
- **Range**: 5 minutes to 8 hours (300000 to 28800000 ms)

### Security Features

#### Encryption
- **Algorithm**: AES-256-GCM with PBKDF2 key derivation
- **Key Derivation**: 100,000 iterations for secure key generation
- **Salt**: Browser-specific information combined with username
- **IV**: Randomly generated 12-byte initialization vector per encryption

#### Auto-logout
- **Inactivity Detection**: Monitors mouse, keyboard, scroll, and touch events
- **Configurable Timeout**: Default 30 minutes, customizable by user
- **Grace Period**: Warns user before automatic logout
- **Event Dispatch**: Fires `auth-expired` event for UI updates

#### Storage Security
- **No Plaintext**: Passwords never stored in plaintext
- **Memory Cleanup**: Automatic cleanup of sensitive data after use
- **Cross-Tab Safety**: Session storage isolated to individual tabs
- **Local Storage Expiry**: Time-based expiration for persistent storage

### Authentication Flow

#### Initial Authentication
1. User enters MusicBrainz credentials in configuration page
2. Credentials validated against MusicBrainz API
3. Upon successful validation, credentials encrypted and stored
4. Authentication state updated across application
5. Collection switcher becomes available in header

#### Authenticated Requests
1. Application retrieves and decrypts stored credentials
2. HTTP Digest authentication headers generated for API requests
3. Private collections and user-specific data become accessible
4. All requests include proper authentication headers

#### Session Management
1. Inactivity timer monitors user interaction
2. Authentication state checked periodically
3. Auto-logout triggers on timeout or authentication failure
4. Credentials cleared from all storage locations on logout

### Collection Switching

When authenticated, users gain access to:

#### Collection Switcher
- **Location**: Header dropdown next to collection name
- **Trigger**: Three-dots (⋯) icon
- **Functionality**: Lists all user collections (public and private)
- **Indicators**: Visual markers for public/private collections

#### Multi-Collection Support
- **Seamless Switching**: Change collections without re-authentication
- **State Preservation**: Filters and preferences maintained per collection
- **Cache Management**: Independent caching for each collection
- **URL Updates**: Collection changes reflected in application state

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

### Required Variables

```env
NEXT_PUBLIC_MUSICBRAINZ_APP_NAME=YourAppName
NEXT_PUBLIC_MUSICBRAINZ_CONTACT_EMAIL=your.email@example.com
```

### Optional Variables

```env
NEXT_PUBLIC_ODESLI_API_KEY=your_odesli_api_key_here
```

## Benefits Over Static Configuration

### Flexibility
- ✅ **No Code Changes Required**: Users can configure collections without touching source code
- ✅ **Multi-User Support**: Different users can configure their own collections on the same deployment
- ✅ **Easy Collection Switching**: Users with multiple collections can easily switch between them

### User Experience
- ✅ **Validation & Help**: UI provides guidance and validation for proper configuration
- ✅ **Immediate Effect**: Changes apply instantly without rebuilding or redeploying the application
- ✅ **Error Recovery**: Built-in fallbacks and user-friendly error messages

### Development
- ✅ **Simplified Deployment**: No need to rebuild for different configurations
- ✅ **Testing**: Easy to test with different configurations
- ✅ **Maintenance**: Configuration changes don't require code deployments

## Integration Points

### Application Integration

The configuration system integrates with various parts of the application:

#### useAlbums Hook
- Loads configuration from localStorage on initialization
- Passes configuration to all data fetching functions
- Manages configuration state throughout the application

#### Header Component
- Displays collection name fetched based on configured collection ID
- Shows configuration status and provides access to settings

#### API Routes
- Use configured User-Agent and collection ID for all MusicBrainz requests
- Respect rate limiting and caching preferences
- Apply streaming platform preferences

#### Filter System
- Respects `useGenresOnly` setting for genre vs tag filtering
- Applies user preferences for data display

## Troubleshooting

### Common Issues

#### Invalid Collection ID
- **Symptom**: Collection name not loading, no albums displayed, or error message in Browse Collections panel
- **Solution**: Use the real-time validation in Browse Collections panel to verify your collection ID
- **Check**:
  - Ensure collection is public (or you're logged in for private collections)
  - Verify collection contains release groups (not individual releases or other entity types)
  - Look for the green checkmark next to the input field
  - Read the validation message for specific error details
- **Formats Accepted**:
  - Collection MBID: `27a3c068-3ec5-421a-ad12-599d085fdeb1`
  - Collection URL: `https://musicbrainz.org/collection/27a3c068-3ec5-421a-ad12-599d085fdeb1`

#### API Rate Limiting
- **Symptom**: Slow loading, error messages about rate limits
- **Solution**: Enable caching, reduce refresh frequency
- **Configuration**: Set `enableCaching: true`

#### Streaming Links Not Working
- **Symptom**: No streaming links appear in album details
- **Solution**: Check streaming platform preferences
- **Configuration**: Verify `enableStreamingLinks: true` and platform list

#### Performance Issues
- **Symptom**: Slow app performance, high memory usage
- **Solution**: Enable caching, optimize image loading
- **Configuration**: Ensure `enableCaching: true`

### Debug Mode

Enable debug logging to troubleshoot configuration issues:

```javascript
localStorage.setItem('debug', 'true');
```

This will provide detailed console output for:
- Configuration loading and validation
- API request details
- Caching operations
- Error conditions

### Validation Errors

The configuration system provides validation for:
- **UUID Format**: Collection IDs must be valid UUIDs
- **Email Format**: User-Agent must include valid contact email
- **Array Format**: Streaming platforms must be valid options
- **Boolean Values**: Settings must be proper boolean types

## Migration from Static Configuration

If upgrading from a version with static configuration:

1. **Backup Settings**: Note your current configuration values
2. **Access Config Page**: Navigate to Settings → Configuration
3. **Enter Values**: Input your previous settings in the UI
4. **Test**: Verify the application works with new configuration
5. **Remove**: Delete old static configuration files if any

The dynamic system is backward compatible and will create default values for any missing settings.