/**
 * @ai-file component
 * @ai-description Lazy loading wrapper for AlbumCard using IntersectionObserver
 * @ai-dependencies React, IntersectionObserver API, AlbumCard
 * @ai-features Viewport-based loading, skeleton placeholders, prioritized rendering, React.memo
 */

import React, { useState, useEffect, useRef } from 'react';
import { ReleaseGroup } from '@/types/music';
import AlbumCard from '../AlbumCard';
import lazyLoadMonitor from '@/utils/lazy-load-monitor';

interface LazyAlbumCardProps {
  album: ReleaseGroup;
  selected: boolean;
  onClick: (album: ReleaseGroup) => void;
  index: number;
}

const LazyAlbumCard: React.FC<LazyAlbumCardProps> = (props) => {
  const { album, selected, onClick, index } = props;
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Always render selected items and items in the initial viewport (first 20)
  useEffect(() => {
    if (selected || index < 20) {
      setIsVisible(true);
      // Track initially visible elements
      lazyLoadMonitor.trackElementVisible();
    }
  }, [selected, index]);

  useEffect(() => {
    // Skip observer setup if already visible
    if (isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Mark as visible when in viewport
          setIsVisible(true);
          // Track this element becoming visible for performance monitoring
          lazyLoadMonitor.trackElementVisible();
          // Disconnect after becoming visible
          observer.disconnect();
        }
      },
      { 
        // Start loading when within 200px of viewport for smoother experience
        rootMargin: '200px',
        threshold: 0.01 // Trigger when just 1% is visible
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  // The skeleton placeholder closely matches AlbumCard layout
  const renderSkeleton = () => {
    const artistNames = album.artist_credit && album.artist_credit.length > 0
      ? album.artist_credit
        .map(credit => `${credit.name}${credit.joinphrase || ''}`)
        .join('')
      : 'Unknown Artist';

    return (
      <div 
        className="flex flex-col cursor-pointer transition-all duration-200 ease-in-out rounded-md overflow-hidden hover:bg-background-secondary p-3"
        onClick={() => {
          // When clicking on placeholder, make it visible immediately and trigger the onClick
          setIsVisible(true);
          onClick(album);
        }}
        data-album-id={album.id} // Add data attribute for scroll position tracking
      >
        <div className="relative aspect-square mb-3 rounded-md overflow-hidden bg-background-tertiary">
          <div 
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 bg-background-tertiary animate-pulse"
          ></div>
        </div>
        
        <div className="flex flex-col flex-grow">
          {/* Use actual text but with placeholder styling for better accessibility */}
          <h3 className="font-medium text-text-primary text-sm line-clamp-1 opacity-30" title={album.title}>
            {album.title}
          </h3>
          <p className="text-text-secondary text-xs line-clamp-1 opacity-30" title={artistNames}>
            {artistNames}
          </p>
          {album.first_release_date && (
            <p className="text-text-tertiary text-xs mt-1 opacity-30">
              {album.first_release_date.split('-')[0]}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={ref}>
      {isVisible ? (
        <AlbumCard 
          album={album}
          selected={selected}
          onClick={onClick}
          index={index}
        />
      ) : (
        renderSkeleton()
      )}
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default React.memo(LazyAlbumCard);
