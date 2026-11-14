/**
 * @ai-file utility
 * @ai-description The address a streaming link opens: web link, or the desktop app's own scheme
 * @ai-features
 * - Spotify (spotify://), Tidal (tidal://) and Apple Music (music://) desktop app links, per user setting
 * - Apple Music geo links resolved once through /api/resolve-apple-music, cached 7 days in localStorage
 * - linkTargetProps: web links open in a new tab, app links in the current one (no empty tab left behind)
 */

import { StreamingServiceKey } from '@/types/preferences';

export interface DesktopAppSettings {
  spotifyUseDesktopApp?: boolean;
  tidalUseDesktopApp?: boolean;
  appleMusicUseDesktopApp?: boolean;
}

// Helper function to transform Spotify URLs for desktop app
const transformSpotifyUrl = (url: string, useDesktopApp: boolean): string => {
  if (!useDesktopApp || !url.includes('open.spotify.com')) {
    return url;
  }

  // Replace https://open.spotify.com/ with spotify://
  return url.replace('https://open.spotify.com/', 'spotify://');
};

// Helper function to transform Tidal URLs for desktop app
const transformTidalUrl = (url: string, useDesktopApp: boolean): string => {
  if (!useDesktopApp || !url.includes('tidal.com')) {
    return url;
  }

  // Handle various Tidal URL formats:
  // https://tidal.com/... -> tidal://...
  // https://listen.tidal.com/... -> tidal://...
  // https://www.tidal.com/... -> tidal://...
  return url
    .replace('https://listen.tidal.com/', 'tidal://')
    .replace('https://www.tidal.com/', 'tidal://')
    .replace('https://tidal.com/', 'tidal://');
};

// Cache key for resolved Apple Music geo URLs
const APPLE_MUSIC_GEO_CACHE_KEY = 'appleMusicGeoCache';
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface GeoCacheEntry {
  resolvedUrl: string;
  timestamp: number;
}

// Get cached resolved URL for Apple Music geo link
const getCachedGeoUrl = (geoUrl: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const cache = localStorage.getItem(APPLE_MUSIC_GEO_CACHE_KEY);
    if (!cache) return null;

    const parsed: Record<string, GeoCacheEntry> = JSON.parse(cache);
    const entry = parsed[geoUrl];

    if (!entry) return null;

    // Check if cache entry is still valid
    const age = Date.now() - entry.timestamp;
    if (age > GEO_CACHE_TTL) {
      // Cache expired, remove it
      delete parsed[geoUrl];
      localStorage.setItem(APPLE_MUSIC_GEO_CACHE_KEY, JSON.stringify(parsed));
      return null;
    }

    return entry.resolvedUrl;
  } catch (error) {
    console.warn('Failed to read Apple Music geo cache:', error);
    return null;
  }
};

// Store resolved URL in cache
const setCachedGeoUrl = (geoUrl: string, resolvedUrl: string): void => {
  if (typeof window === 'undefined') return;

  try {
    const cache = localStorage.getItem(APPLE_MUSIC_GEO_CACHE_KEY);
    const parsed: Record<string, GeoCacheEntry> = cache ? JSON.parse(cache) : {};

    parsed[geoUrl] = {
      resolvedUrl,
      timestamp: Date.now(),
    };

    localStorage.setItem(APPLE_MUSIC_GEO_CACHE_KEY, JSON.stringify(parsed));
    console.log(`💾 Cached Apple Music geo resolution: ${geoUrl} → ${resolvedUrl}`);
  } catch (error) {
    console.warn('Failed to store Apple Music geo cache:', error);
  }
};

// Helper function to resolve and transform Apple Music URLs for desktop app
export const resolveAppleMusicUrl = async (url: string): Promise<string> => {
  // Check if this is a geo link that needs resolution
  if (!url.includes('geo.music.apple.com')) {
    // Not a geo link, just extract path for music:// protocol
    const urlObj = new URL(url);
    const pathAndQuery = urlObj.pathname + urlObj.search;
    return `music://${pathAndQuery}`;
  }

  // Check cache first
  const cached = getCachedGeoUrl(url);
  if (cached) {
    console.log(`⚡ Cache hit for Apple Music geo URL: ${url}`);
    return cached;
  }

  // Resolve geo link via API
  try {
    console.log(`🔍 Resolving Apple Music geo link: ${url}`);
    const response = await fetch(`/api/resolve-apple-music?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (data.success && data.finalUrl) {
      // Convert final URL to music:// protocol
      const finalUrl = data.finalUrl.replace('https://', 'music://');

      // Cache the resolved URL
      setCachedGeoUrl(url, finalUrl);

      console.log(`✅ Resolved and converted: ${url} → ${finalUrl}`);
      return finalUrl;
    } else {
      // Fallback: use original geo URL (will open in browser)
      console.warn(`⚠️ Failed to resolve geo URL, using original: ${url}`);
      return url;
    }
  } catch (error) {
    console.error('❌ Error resolving Apple Music geo URL:', error);
    // Fallback: use original URL
    return url;
  }
};

// Helper function to transform Apple Music URLs for desktop app
const transformAppleMusicUrl = (url: string, useDesktopApp: boolean): string => {
  if (!useDesktopApp || !url.includes('music.apple.com')) {
    return url;
  }

  // For non-geo URLs, do simple transformation
  if (!url.includes('geo.music.apple.com')) {
    const urlObj = new URL(url);
    const pathAndQuery = urlObj.pathname + urlObj.search;
    return `music://${pathAndQuery}`;
  }

  // For geo URLs, return the original URL for now
  // The actual resolution happens in useEffect
  return url;
};

/**
 * The address to open for a service link, honouring the "Open in desktop app" settings.
 * Apple Music geo links stay web links here; useServiceOpenUrls swaps in the resolved app link.
 */
export const openUrlFor = (service: StreamingServiceKey, url: string, settings: DesktopAppSettings): string => {
  if (service === 'spotify') return transformSpotifyUrl(url, !!settings.spotifyUseDesktopApp);
  if (service === 'tidal') return transformTidalUrl(url, !!settings.tidalUseDesktopApp);
  if (service === 'appleMusic') return transformAppleMusicUrl(url, !!settings.appleMusicUseDesktopApp);
  return url;
};

/** Whether an Apple Music link must be resolved before it can open in the app */
export const needsAppleMusicResolution = (service: StreamingServiceKey, url: string, settings: DesktopAppSettings) =>
  service === 'appleMusic' && !!settings.appleMusicUseDesktopApp && url.includes('geo.music.apple.com');

// Web links open in a new tab. App links (spotify://, tidal://, music://)
// open in the current tab: the browser hands them to the app and the page
// stays, so no empty tab is left behind.
export const linkTargetProps = (href: string) =>
  /^https?:/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
