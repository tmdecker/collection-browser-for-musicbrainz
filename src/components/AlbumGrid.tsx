/**
 * @ai-file component
 * @ai-description Responsive grid layout for album cards with loading and empty states
 * @ai-dependencies React, AlbumCard, SkeletonAlbumCard, normalizeReleaseGroups
 * @ai-features
 * - Responsive grid layout (1-6 columns based on screen size)
 * - Loading skeleton UI with placeholder cards
 * - Empty state messaging
 * - Album selection management with hover states
 */

import React from 'react';
import { ReleaseGroup } from '@/types/music';
import AlbumCard from './AlbumCard';
import { normalizeReleaseGroups } from '@/utils/normalize-mb-data';

interface AlbumGridProps {
  albums: ReleaseGroup[];
  selectedAlbum: ReleaseGroup | null;
  onSelectAlbum: (album: ReleaseGroup) => void;
  loading: boolean;
}

const AlbumGrid: React.FC<AlbumGridProps> = ({
  albums,
  selectedAlbum,
  onSelectAlbum,
  loading
}) => {
  // Ensure albums are normalized before rendering
  const normalizedAlbums = React.useMemo(() => {
    try {
      const normalized = normalizeReleaseGroups(albums);
      return normalized;
    } catch (error) {
      return albums;
    }
  }, [albums]);

  if (loading) {
    return (
      <div className="grid grid-cols-album-grid md:grid-cols-album-grid-tablet lg:grid-cols-album-grid-desktop gap-1 px-0 py-3 md:px-6 md:py-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="animate-pulse p-3">
            <div className="bg-background-tertiary aspect-square rounded-md mb-3"></div>
            <div className="bg-background-tertiary h-4 rounded-md w-3/4 mb-2"></div>
            <div className="bg-background-tertiary h-3 rounded-md w-1/2"></div>
          </div>
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

  return (
    <div className="grid grid-cols-album-grid md:grid-cols-album-grid-tablet lg:grid-cols-album-grid-desktop gap-1 px-0 py-3 md:px-6 md:py-6">
      {normalizedAlbums.map((album, index) => (
        <AlbumCard
          key={album.id}
          album={album}
          selected={selectedAlbum?.id === album.id}
          onClick={onSelectAlbum}
          index={index} // Pass the index for loading priority
        />
      ))}
    </div>
  );
};

export default AlbumGrid;
