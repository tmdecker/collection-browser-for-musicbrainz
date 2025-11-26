/**
 * @ai-file component
 * @ai-description Skeleton loading component for album cards during data fetching
 * @ai-dependencies React
 * @ai-features
 * - Visual placeholder with pulse animation
 * - Matches dimensions of actual album cards
 * - Skeleton image placeholder and text lines for title/artist
 */

import React from 'react';

interface SkeletonAlbumCardProps {
  className?: string;
}

const SkeletonAlbumCard: React.FC<SkeletonAlbumCardProps> = ({ className = '' }) => {
  return (
    <div className={`rounded-md overflow-hidden bg-background-secondary transition-all duration-200 animate-pulse ${className}`}>
      {/* Skeleton image */}
      <div className="aspect-square bg-background-tertiary" />
      
      {/* Skeleton text content */}
      <div className="p-3">
        {/* Title */}
        <div className="h-4 bg-background-tertiary rounded w-3/4 mb-2" />
        
        {/* Artist */}
        <div className="h-3 bg-background-tertiary rounded w-1/2 mb-1" />
        
        {/* Year */}
        <div className="h-3 bg-background-tertiary rounded w-1/4" />
      </div>
    </div>
  );
};

export default SkeletonAlbumCard;
