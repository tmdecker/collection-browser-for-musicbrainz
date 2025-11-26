/**
 * @ai-file component
 * @ai-description Grid layout component that implements lazy loading for albums
 * @ai-dependencies React, LazyAlbumCard, normalize-mb-data utility, SkeletonAlbumCard
 * @ai-features Responsive grid, lazy loading, skeleton UI, IntersectionObserver, prioritized loading
 */

import React, { useEffect } from 'react';
import { ReleaseGroup } from '@/types/music';
import LazyAlbumCard from './LazyAlbumCard';
import SkeletonAlbumCard from '../SkeletonAlbumCard';
import lazyLoadMonitor from '@/utils/lazy-load-monitor';

interface LazyAlbumGridProps {
  albums: ReleaseGroup[];
  selectedAlbum: ReleaseGroup | null;
  onSelectAlbum: (album: ReleaseGroup) => void;
  loading: boolean;
}

const LazyAlbumGrid: React.FC<LazyAlbumGridProps> = ({ 
  albums, 
  selectedAlbum, 
  onSelectAlbum,
  loading 
}) => {
  console.log(`🟥 LazyAlbumGrid received ${albums.length} albums from parent`);

  // Albums are already normalized by useAlbums, no need to normalize again
  const normalizedAlbums = albums;
  
  // Initialize the performance monitor with the total number of albums
  useEffect(() => {
    // Reset monitor when albums change (e.g., after search/filter)
    lazyLoadMonitor.reset();
    lazyLoadMonitor.setTotalElements(normalizedAlbums.length);
    
    // Generate a performance report when component unmounts
    return () => {
      lazyLoadMonitor.generateSummaryReport();
    };
  }, [normalizedAlbums.length]);

  if (loading) {
    return (
      <div className="grid grid-cols-album-grid md:grid-cols-album-grid-tablet lg:grid-cols-album-grid-desktop gap-1 px-3 pt-0 pb-3 md:px-6 md:pt-0 md:pb-6">
        {Array.from({ length: 24 }).map((_, index) => (
          <SkeletonAlbumCard key={index} />
        ))}
      </div>
    );
  }

  if (normalizedAlbums.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        No albums found. Try adjusting your search.
      </div>
    );
  }

  // Calculate "closeness" to selected item to prioritize loading
  const selectedIndex = selectedAlbum ? normalizedAlbums.findIndex(album => album.id === selectedAlbum.id) : -1;

  return (
    <div className="grid grid-cols-album-grid md:grid-cols-album-grid-tablet lg:grid-cols-album-grid-desktop gap-1 px-3 pt-0 pb-3 md:px-6 md:pt-0 md:pb-6">
      {normalizedAlbums.map((album, index) => {
        // Prioritize items near the selected album
        const isNearSelected = selectedIndex !== -1 ? 
          Math.abs(selectedIndex - index) < 20 : false;
        
        // If it's near selected, we can pass a lower index to ensure it gets loaded
        const priorityIndex = isNearSelected ? Math.min(index, 15) : index;
        
        return (
          <LazyAlbumCard
            key={album.id}
            album={album}
            selected={selectedAlbum?.id === album.id}
            onClick={onSelectAlbum}
            index={priorityIndex} // Lower index will be loaded earlier
          />
        );
      })}
    </div>
  );
};

export default React.memo(LazyAlbumGrid);
