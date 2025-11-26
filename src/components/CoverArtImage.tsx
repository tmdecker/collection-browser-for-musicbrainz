/**
 * @ai-file component
 * @ai-description Cover art image with optimized loading, error states, and fallbacks
 * @ai-dependencies React, Next.js Image
 * @ai-features
 * - URL transformation for MusicBrainz and CoverArt Archive compatibility
 * - Error handling with fallback content
 * - Priority loading support
 * - Skips Next.js optimization for coverartarchive.org URLs
 */

import React, { useState, useEffect } from 'react';

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

interface CoverArtImageProps {
  src?: string;
  mbid?: string;
  title?: string;
  alt?: string;
  size?: number;
  priority?: boolean;
  onLoad?: () => void;
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
  const [error, setError] = useState(false);

  // Reset error state when the image source changes
  useEffect(() => {
    setError(false);
  }, [actualSrc, mbid]);
  
  // Generate a stable cache key regardless of size
  const generateCacheKey = (url: string | undefined): string => {
    if (!url) return '';
    
    // For CoverArt API, use the MusicBrainz ID as the cache key
    if (url.startsWith('/api/coverart/')) {
      const match = url.match(/release-group\/([a-f0-9-]+)\//);
      if (match && match[1]) return `mbid:${match[1]}`;
    }
    
    // For HTTP URLs, create a key without size parameters
    return url.replace(/[&?]([wh])=\d+/g, '');
  };

  // Function to transform cover art URLs for better compatibility and optimization
  const transformImageUrl = (url: string | undefined, requestedSize: number = size): string => {
    if (!url) return '/placeholder.svg';
    
    try {
      // Generate a cache key for this image
      const cacheKey = generateCacheKey(url);
      
      // Check if we already have this image in the cache at any size
      if (cacheKey && window.mbImageCache && window.mbImageCache[cacheKey]) {
        // If we have this exact size, use it directly
        if (window.mbImageCache[cacheKey].loadedSizes[requestedSize]) {
          return window.mbImageCache[cacheKey].loadedSizes[requestedSize];
        }
        
        // If we have any size loaded, use the closest one while loading the requested size
        const sizesAvailable = Object.keys(window.mbImageCache[cacheKey].loadedSizes)
          .map(Number)
          .sort((a, b) => a - b);
        
        if (sizesAvailable.length > 0) {
          // Use the closest available size (prefer larger if available)
          const closestSize = sizesAvailable.reduce((prev, curr) => 
            Math.abs(curr - requestedSize) < Math.abs(prev - requestedSize) ? curr : prev
          );
          
          console.log(`Using cached image at ${closestSize}px while loading ${requestedSize}px`);
          return window.mbImageCache[cacheKey].loadedSizes[closestSize];
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
        return `/api/image?url=${encodeURIComponent(normalizedUrl)}&w=${requestedSize}&h=${requestedSize}&q=80`;
      }
      
      return normalizedUrl;
    } catch (error) {
      console.error('Error transforming image URL:', error);
      return '/placeholder.svg';
    }
  };
  
  const imageUrl = transformImageUrl(actualSrc);
  
  const handleError = () => {
    console.log(`Error loading cover art: ${imageUrl}`);
    setError(true);
    if (onError) onError();
  };
  
  const handleLoad = () => {
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
        console.log(`Cached image ${cacheKey} at size ${size}px`);
      }
    }
    
    if (onLoad) onLoad();
  };
  
  if (error) {
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
      quality={80}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      // Now using our custom image optimization API instead of skipping optimization
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