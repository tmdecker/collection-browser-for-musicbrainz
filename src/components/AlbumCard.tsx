/**
 * @ai-file component
 * @ai-description Individual album card with cover art, title, artist, and release year
 * @ai-dependencies React, Next.js Image, CoverArtImage, clsx
 * @ai-features
 * - Responsive card with cover art and metadata
 * - Dynamic placeholder generation with color based on album title
 * - Loading states with smooth transitions
 * - Selected state with highlight border
 */

import React, { useState, useEffect } from 'react';
import NextImage from 'next/image'; // Renamed to avoid conflict with global Image
import { ReleaseGroup } from '@/types/music';
import clsx from 'clsx';
import CoverArtImage from './CoverArtImage';

interface AlbumCardProps {
  album: ReleaseGroup;
  selected: boolean;
  onClick: (album: ReleaseGroup) => void;
  index?: number;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ 
  album, 
  selected, 
  onClick,
  index = 0
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Generate a color based on album title for the placeholder background
  const generatePlaceholderColor = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 40%, 25%)`;
  };

  const artistNames = album.artist_credit && album.artist_credit.length > 0
    ? album.artist_credit
      .map(credit => {
        // Try to handle both structures
        const name = credit.artist?.name || credit.name || '';
        const joinphrase = credit.joinphrase || '';
        return name + joinphrase;
      })
      .filter(Boolean)
      .join('')
    : 'Unknown Artist';

  const releaseYear = album.first_release_date 
    ? album.first_release_date.split('-')[0] 
    : '';
    
  // Generate placeholder color based on album title
  const placeholderColor = generatePlaceholderColor(album.title);
  
  // Debug log image size in development (only for first visible album)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && index === 0 && album.cover) {
      // Use the global Image constructor (not the Next.js Image component)
      const img = new window.Image();
      img.onload = () => {
        console.log(`Original image for "${album.title}": ${img.width}×${img.height}, displayed at 360px`);
        console.log(`Size ratio: ${(img.width * img.height) / (360 * 360)}x larger than needed`);
        
        // Additional debug to check if image optimization is being applied
        if (album.cover?.startsWith('http')) {
          // Check the optimized image size for comparison
          const optimized = new window.Image();
          optimized.onload = () => {
            console.log(`Optimized image: ${optimized.width}×${optimized.height}, optimized to WebP format`);
            console.log(`Optimization ratio: ${(img.width * img.height) / (optimized.width * optimized.height)}x`);
          };
          optimized.src = `/api/image?url=${encodeURIComponent(album.cover)}&w=360&h=360&q=80`;
        }
      };
      img.src = album.cover;
    }
  }, [album.cover, album.title, index]);

  return (
    <div
      className={clsx(
        'flex flex-col cursor-pointer transition-all duration-200 ease-in-out',
        'rounded-md overflow-hidden hover:bg-background-secondary p-1.5 md:p-3',
        selected && 'bg-background-secondary ring-2 ring-primary',
      )}
      onClick={() => onClick(album)}
      data-album-id={album.id} // Add data attribute for scroll position tracking
    >
      <div className="relative aspect-square mb-2 md:mb-3 rounded-md overflow-hidden bg-background-tertiary">
        {/* Placeholder while image loads */}
        {!imageLoaded && !imageError && (
          <div 
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 bg-background-tertiary animate-pulse"
          ></div>
        )}
        
        {/* We no longer show colored placeholder for error state as CoverArtImage will handle it */}
        
        {/* Cover Art Image with specialized handling */}
        <CoverArtImage
          src={album.cover}
          alt={`${album.title} by ${artistNames}`}
          priority={index < 20 || selected}
          className={`object-cover transition-opacity duration-300 ${imageLoaded && !imageError ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            console.log(`Error loading image for ${album.id}: ${album.title}`);
            setImageError(true);
          }}
        />
      </div>
      
      <div className="flex flex-col flex-grow">
        <h3 className="font-medium text-text-primary text-xs md:text-sm line-clamp-1" title={album.title}>
          {album.title}
        </h3>
        <p className="text-text-secondary text-xs md:text-sm line-clamp-1" title={artistNames}>
          {artistNames}
        </p>
        {releaseYear && (
          <p className="text-text-tertiary text-[10px] md:text-xs mt-0.5 md:mt-1">
            {releaseYear}
          </p>
        )}
      </div>
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default React.memo(AlbumCard);
