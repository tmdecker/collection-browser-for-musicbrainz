/**
 * @ai-file component
 * @ai-description Cover art image with optimized loading, error states, and fallbacks
 * @ai-dependencies React, Next.js Image
 * @ai-features
 * - URL transformation for MusicBrainz and CoverArt Archive compatibility
 * - Error handling with fallback content
 * - Priority loading support
 * - Skips Next.js optimization for coverartarchive.org URLs
 * - Loads the new cover after a manual album refresh (cover version in the URL)
 * - Tries a failed cover again after 5 s and 30 s (e.g. during a deploy), unless the server said it does not exist (404)
 */

import React, { useState, useEffect, useRef } from 'react';

// Define the type for our global image cache
interface ImageCache {
  [key: string]: {
    url: string;
    loadedSizes: { [size: number]: string };
  };
}

// Initialize global image cache if it doesn't exist
if (typeof window !== 'undefined' && !window.mbImageCache) {
  window.mbImageCache = {} as ImageCache;
}
import NextImage from 'next/image';
import { useCoverVersion } from '@/utils/cover-versions';

// A cover that failed for another reason than "not found" (server restarting for a deploy, a download
// that failed) is tried again after these delays; the second one outlasts a build. Two more requests at
// most, so a grid during an outage does not hammer the server or MetaBrainz
const RETRY_DELAYS_MS = [5000, 30000];

interface CoverArtImageProps {
  src?: string;
  mbid?: string;
  title?: string;
  alt?: string;
  size?: number;
  priority?: boolean;
  /** Gets the loaded image, e.g. to read its colours */
  onLoad?: (img: HTMLImageElement) => void;
  onError?: () => void;
  className?: string;
}

/**
 * Specialized component for handling cover art images with proper error handling
 * and fallback mechanisms for the MusicBrainz application.
 */
const CoverArtImage: React.FC<CoverArtImageProps> = ({
  src,
  mbid,
  title,
  alt,
  size = 360,
  priority = false,
  onLoad,
  onError,
  className = '',
}) => {
  // If we have an mbid but no src, construct the coverart URL
  const actualSrc = src || (mbid ? `/api/coverart/release-group/${mbid}/front` : undefined);
  // Use provided alt text or fallback to title
  const altText = alt || (title ? `Cover art for ${title}` : 'Album cover art');
  // Set when the album was refreshed by hand: a new URL, so the browser cache cannot answer with the old cover
  const coverVersion = useCoverVersion(actualSrc?.match(/^\/api\/coverart\/release-group\/([a-f0-9-]+)\//)?.[1]);
  // Remember which source failed, so a new source (or cover version) automatically starts without an error
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const sourceKey = `${actualSrc ?? ''}#${coverVersion ?? ''}`;
  const error = failedSrc === sourceKey;
  // Retries made for the current source (a new URL for each, so the browser asks the server again)
  const [retries, setRetries] = useState<{ key: string; count: number }>({ key: '', count: 0 });
  const retryCount = retries.key === sourceKey ? retries.count : 0;
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(retryTimer.current), []);
  
  // Generate a stable cache key regardless of size
  const generateCacheKey = (url: string | undefined): string => {
    if (!url) return '';
    
    // For CoverArt API, use the MusicBrainz ID (and cover version) as the cache key
    if (url.startsWith('/api/coverart/')) {
      const match = url.match(/release-group\/([a-f0-9-]+)\//);
      if (match && match[1]) return `mbid:${match[1]}${coverVersion ? `@${coverVersion}` : ''}`;
    }
    
    // For HTTP URLs, create a key without size parameters
    return url.replace(/[&?]([wh])=\d+/g, '');
  };

  // Function to transform cover art URLs for better compatibility and optimization
  const transformImageUrl = (url: string | undefined, requestedSize: number = size): string => {
    // No cover: normalized data marks a missing cover with '/placeholder.svg'
    if (!url || url === '/placeholder.svg') return '';
    
    try {
      // Generate a cache key for this image
      const cacheKey = generateCacheKey(url);
      
      // Check if we already have this image in the cache at any size
      if (cacheKey && window.mbImageCache && window.mbImageCache[cacheKey]) {
        // If we have this exact size, use it directly
        if (window.mbImageCache[cacheKey].loadedSizes[requestedSize]) {
          return window.mbImageCache[cacheKey].loadedSizes[requestedSize];
        }
        
        // Reuse an already loaded image only if it is at least as large as the one asked for. A smaller one
        // (e.g. the grid thumbnail) used to be returned here and then stored as this size, so the larger
        // cover was never loaded
        const largerSize = Object.keys(window.mbImageCache[cacheKey].loadedSizes)
          .map(Number)
          .sort((a, b) => a - b)
          .find(loaded => loaded >= requestedSize);
        if (largerSize !== undefined) {
          return window.mbImageCache[cacheKey].loadedSizes[largerSize];
        }
      }
      
      // Special case for CoverArt API - normalize to a standard URL
      let normalizedUrl = url;
      if (url.startsWith('/api/coverart/')) {
        // Convert to direct coverartarchive.org URL
        const coverartPath = url.replace('/api/coverart/', '');
        normalizedUrl = `https://coverartarchive.org/${coverartPath}`;
      }
      
      // Use the custom image optimization API for all external images
      if (normalizedUrl.startsWith('http')) {
        // Make sure to encode the URL properly
        const version = coverVersion ? `&v=${coverVersion}` : '';
        const retry = retryCount ? `&retry=${retryCount}` : '';
        return `/api/image?url=${encodeURIComponent(normalizedUrl)}&w=${requestedSize}&h=${requestedSize}&q=80${version}${retry}`;
      }
      
      return normalizedUrl;
    } catch (error) {
      console.error('Error transforming image URL:', error);
      return '';
    }
  };
  
  const imageUrl = transformImageUrl(actualSrc);
  
  // Nothing to load: tell the parent right away so it stops showing its loading state
  useEffect(() => {
    if (!imageUrl && onError) onError();
  }, [imageUrl, onError]);

  const giveUp = (key: string) => {
    setFailedSrc(key);
    if (onError) onError();
  };

  const handleError = () => {
    console.log(`Error loading cover art: ${imageUrl}`);
    const key = sourceKey;
    const retryDelay = RETRY_DELAYS_MS[retryCount];
    if (retryDelay === undefined || !imageUrl.startsWith('/api/image')) {
      giveUp(key);
      return;
    }
    // Missing covers are answered 404, which the browser keeps for a day: read that answer from the
    // browser cache (no request to the server) and show the fallback at once. Anything else was a
    // failed request: try again later
    fetch(imageUrl, { cache: 'only-if-cached', mode: 'same-origin' })
      .then(response => response.status)
      .catch(() => 0)
      .then(status => {
        if (status === 404) {
          giveUp(key);
          return;
        }
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => setRetries({ key, count: retryCount + 1 }), retryDelay);
      });
  };
  
  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    // Save the loaded image to cache
    if (actualSrc) {
      const cacheKey = generateCacheKey(actualSrc);
      
      if (cacheKey && typeof window !== 'undefined') {
        // Initialize entry if it doesn't exist
        if (!window.mbImageCache[cacheKey]) {
          window.mbImageCache[cacheKey] = {
            url: actualSrc,
            loadedSizes: {}
          };
        }
        
        // Add this size to the loaded sizes
        window.mbImageCache[cacheKey].loadedSizes[size] = imageUrl;
      }
    }
    
    if (onLoad) onLoad(img);
  };
  
  if (error || !imageUrl) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-background-tertiary text-text-tertiary text-sm">
        No Cover Available
      </div>
    );
  }
  
  return (
    <NextImage
      src={imageUrl}
      alt={altText}
      fill
      sizes={`${size}px`}
      priority={priority}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      // /api/image already resizes and converts to WebP, so skip Next's optimizer
      // (avoids double processing; Next 16 also rejects local src with a query string)
      unoptimized
    />
  );
};

// Add TypeScript declaration for window object
declare global {
  interface Window {
    mbImageCache: ImageCache;
  }
}

export default CoverArtImage;