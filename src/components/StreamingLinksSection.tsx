/**
 * @ai-file component
 * @ai-description Streaming platform links with icons and hover effects
 * @ai-dependencies react-icons (bi, si collections), StreamingLinks type
 * @ai-features
 * - Platform icons for Spotify, Apple Music, YouTube, Amazon, Deezer, Tidal, SoundCloud, Pandora
 * - Responsive layout with hover effects and tooltips
 * - Conditional fade-in animation (only when NOT loaded from cache)
 * - Desktop app URL rewriting for Spotify
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BiLogoSpotify,
  BiLogoDeezer,
  BiLogoYoutube,
  BiLogoSoundcloud,
  BiLogoAmazon,
  BiMusic
} from 'react-icons/bi';
import {
  SiTidal,
  SiApplemusic,
  SiAmazonmusic,
  SiYoutubemusic,
  SiPandora
} from 'react-icons/si';
import { StreamingLinks } from '@/types/music';
import { StreamingServicePreferences, DEFAULT_STREAMING_SERVICES } from '@/types/preferences';

interface StreamingLinksSectionProps {
  streamingLinks?: StreamingLinks | null;
  loading?: boolean;
  fromCache?: boolean;
  spotifyUseDesktopApp?: boolean;
  tidalUseDesktopApp?: boolean;
  appleMusicUseDesktopApp?: boolean;
  enabledServices?: StreamingServicePreferences;
}

interface PlatformConfig {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  name: string;
  color: string; // Hover color class
}

// Platform configuration with icons and styling
const PLATFORM_CONFIGS: Record<keyof Omit<StreamingLinks, 'thumbnail'>, PlatformConfig> = {
  spotify: {
    icon: BiLogoSpotify,
    name: 'Spotify',
    color: 'hover:text-white',
  },
  appleMusic: {
    icon: SiApplemusic,
    name: 'Apple Music',
    color: 'hover:text-white',
  },
  youtube: {
    icon: BiLogoYoutube,
    name: 'YouTube',
    color: 'hover:text-white',
  },
  youtubeMusic: {
    icon: SiYoutubemusic,
    name: 'YouTube Music',
    color: 'hover:text-white',
  },
  amazon: {
    icon: BiLogoAmazon,
    name: 'Amazon',
    color: 'hover:text-white',
  },
  amazonMusic: {
    icon: SiAmazonmusic,
    name: 'Amazon Music',
    color: 'hover:text-white',
  },
  deezer: {
    icon: BiLogoDeezer,
    name: 'Deezer',
    color: 'hover:text-white',
  },
  tidal: {
    icon: SiTidal,
    name: 'Tidal',
    color: 'hover:text-white',
  },
  soundcloud: {
    icon: BiLogoSoundcloud,
    name: 'SoundCloud',
    color: 'hover:text-white',
  },
  pandora: {
    icon: SiPandora,
    name: 'Pandora',
    color: 'hover:text-white',
  },
};

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
const resolveAppleMusicUrl = async (url: string): Promise<string> => {
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

const StreamingLinksSection: React.FC<StreamingLinksSectionProps> = ({
  streamingLinks,
  loading = false,
  fromCache = false,
  spotifyUseDesktopApp = false,
  tidalUseDesktopApp = false,
  appleMusicUseDesktopApp = false,
  enabledServices = DEFAULT_STREAMING_SERVICES,
}) => {
  // State to hold resolved Apple Music URLs (must be before any returns)
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  // Resolve Apple Music geo URLs when component mounts or when Apple Music links change
  // Must be called before any conditional returns
  useEffect(() => {
    const resolveGeoUrls = async () => {
      if (!appleMusicUseDesktopApp || !streamingLinks?.appleMusic) return;

      const url = streamingLinks.appleMusic;

      // Only resolve geo URLs
      if (!url.includes('geo.music.apple.com')) return;

      // Skip if already resolved
      if (resolvedUrls[url]) return;

      const resolved = await resolveAppleMusicUrl(url);
      setResolvedUrls(prev => ({ ...prev, [url]: resolved }));
    };

    resolveGeoUrls();
  }, [streamingLinks?.appleMusic, appleMusicUseDesktopApp, resolvedUrls]);

  // Don't render anything while loading (no skeletons)
  if (loading) {
    return null;
  }

  // Don't render if no streaming links
  if (!streamingLinks || Object.keys(streamingLinks).length === 0) {
    return null;
  }

  // Filter out thumbnail and get available platforms, then filter by enabled services
  const availablePlatforms = Object.entries(streamingLinks || {})
    .filter(([key, url]) => {
      if (key === 'thumbnail' || !url) return false;

      // Check if this service is enabled in user preferences
      const servicePlatform = key as keyof Omit<StreamingLinks, 'thumbnail'>;
      return enabledServices[servicePlatform] !== false;
    })
    .map(([platform, url]) => ({
      platform: platform as keyof Omit<StreamingLinks, 'thumbnail'>,
      url: url as string,
    }));

  if (availablePlatforms.length === 0) {
    return null;
  }

  // Only apply fade-in animation if NOT from cache
  const shouldAnimate = !fromCache;

  return (
    <div className={shouldAnimate ? 'animate-fade-in' : ''} style={shouldAnimate ? { animation: 'fadeIn 0.4s ease-in' } : {}}>
      {shouldAnimate && (
        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}</style>
      )}
      <div className="flex flex-wrap gap-2">
        {availablePlatforms.map(({ platform, url }) => {
          const config = PLATFORM_CONFIGS[platform];
          // Transform URLs for desktop apps if enabled
          let finalUrl = url;
          if (platform === 'spotify') {
            finalUrl = transformSpotifyUrl(url, spotifyUseDesktopApp);
          } else if (platform === 'tidal') {
            finalUrl = transformTidalUrl(url, tidalUseDesktopApp);
          } else if (platform === 'appleMusic') {
            // Use resolved URL if available (for geo links), otherwise transform normally
            finalUrl = resolvedUrls[url] || transformAppleMusicUrl(url, appleMusicUseDesktopApp);
          }

          if (!config) {
            // Fallback for unknown platforms
            return (
              <Link
                key={platform}
                href={finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-6 h-6 md:w-6 md:h-6 text-text-secondary hover:text-white transition-colors duration-200"
                title={`Open on ${platform}`}
              >
                <BiMusic className="w-[34px] h-[34px] md:w-6 md:h-6" />
              </Link>
            );
          }

          const IconComponent = config.icon;

          return (
            <Link
              key={platform}
              href={finalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center w-6 h-6 md:w-6 md:h-6 text-text-secondary transition-colors duration-200 ${config.color}`}
              title={`Open on ${config.name}`}
            >
              <IconComponent className="w-[34px] h-[34px] md:w-6 md:h-6" />
            </Link>
          );
        })}
      </div>
      <div className="text-xs text-text-tertiary mt-2">
        Powered by{' '}
        <a
          href="https://odesli.co"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text-secondary transition-colors duration-200"
        >
          Songlink
        </a>
      </div>
    </div>
  );
};

export default StreamingLinksSection;