/**
 * @ai-file component
 * @ai-description Lazy loading wrapper for AlbumCard using IntersectionObserver
 * @ai-dependencies React, IntersectionObserver API, AlbumCard
 * @ai-features Viewport-based loading (one shared observer, 800px ahead), static placeholders, prioritized rendering, React.memo
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

// One observer for the whole grid instead of one per card (a large collection had over a thousand).
// Cards are shown a good stretch before they scroll into view, so fast scrolling on a phone does not
// run into a row of cards that are still being mounted
const callbacks = new Map<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;

const observeOnce = (element: Element, onVisible: () => void): (() => void) => {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        sharedObserver?.unobserve(entry.target);
        const callback = callbacks.get(entry.target);
        callbacks.delete(entry.target);
        callback?.();
      }
    }, { rootMargin: '800px 0px' });
  }
  callbacks.set(element, onVisible);
  sharedObserver.observe(element);
  return () => {
    callbacks.delete(element);
    sharedObserver?.unobserve(element);
  };
};

const LazyAlbumCard: React.FC<LazyAlbumCardProps> = (props) => {
  const { album, selected, onClick, index } = props;
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Always render selected items and items in the initial viewport (first 20); once shown, stay shown
  const forceVisible = selected || index < 20;
  if (forceVisible && !isVisible) {
    setIsVisible(true);
  }

  // Track initially visible elements for performance monitoring
  useEffect(() => {
    if (forceVisible) {
      lazyLoadMonitor.trackElementVisible();
    }
  }, [forceVisible]);

  useEffect(() => {
    if (isVisible || !ref.current) return;
    return observeOnce(ref.current, () => {
      setIsVisible(true);
      lazyLoadMonitor.trackElementVisible();
    });
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
        className="flex flex-col cursor-pointer rounded-md overflow-hidden hover:bg-background-secondary p-1.5 md:p-2"
        onClick={() => {
          // When clicking on placeholder, make it visible immediately and trigger the onClick
          setIsVisible(true);
          onClick(album);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsVisible(true);
            onClick(album);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${album.title} by ${artistNames}`}
        data-album-id={album.id} // Add data attribute for scroll position tracking
      >
        <div className="relative aspect-square mb-2 md:mb-3 rounded-md overflow-hidden bg-background-tertiary">
          <div 
            className="absolute inset-0 bg-background-tertiary"
          ></div>
        </div>
        
        <div className="flex flex-col flex-grow">
          {/* Use actual text but with placeholder styling for better accessibility */}
          <h3 className="font-medium text-text-primary text-xs md:text-sm line-clamp-2 md:line-clamp-1 opacity-30" title={album.title}>
            {album.title}
          </h3>
          <p className="text-text-secondary text-xs md:text-sm line-clamp-1 opacity-30" title={artistNames}>
            {artistNames}
          </p>
          {album.first_release_date && (
            <p className="text-text-tertiary text-[10px] md:text-xs mt-0.5 md:mt-1 opacity-30">
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
