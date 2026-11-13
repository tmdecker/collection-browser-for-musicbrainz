/**
 * @ai-file component
 * @ai-description Individual album card with cover art, title, artist, and release year
 * @ai-dependencies React, Next.js Image, CoverArtImage, clsx
 * @ai-features
 * - Responsive card with cover art and metadata
 * - Loading states with smooth transitions
 * - Selected state with highlight border
 * - Opens with Enter or Space when focused
 */

import React, { useState } from 'react';
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
    
  return (
    <div
      className={clsx(
        'flex flex-col cursor-pointer transition-colors duration-200 ease-in-out',
        'rounded-md overflow-hidden hover:bg-background-secondary p-1.5 md:p-2',
        selected && 'bg-background-secondary ring-2 ring-primary',
      )}
      onClick={() => onClick(album)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(album);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${album.title} by ${artistNames}${releaseYear ? `, ${releaseYear}` : ''}`}
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
          onLoad={() => {
            setImageLoaded(true);
            setImageError(false); // A cover added on MusicBrainz and refreshed by hand replaces the fallback
          }}
          onError={() => {
            console.log(`Error loading image for ${album.id}: ${album.title}`);
            setImageError(true);
          }}
        />
      </div>
      
      <div className="flex flex-col flex-grow">
        <h3 className="font-medium text-text-primary text-xs md:text-sm line-clamp-2 md:line-clamp-1" title={album.title}>
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
