/**
 * @ai-file component
 * @ai-description Track listing display with disc organization and label filtering
 * @ai-dependencies React, Track/ArtistCredit/Release types, extractLabelsFromAlbum
 * @ai-features
 * - Displays track number, title, artist credits, and duration (MM:SS format)
 * - Shows artist credits when different from album artist
 * - Disc grouping with disc titles
 * - Label display with filter toggle functionality
 * - Shows total track count and duration
 */

import React from 'react';
import { Track, ArtistCredit, Release } from '@/types/music';
import { extractLabelsFromAlbum } from '@/utils/label-processor';

interface TrackListProps {
  tracks?: Track[];
  albumArtist?: string;
  loading?: boolean;
  releaseDetails?: Release;
  onToggleLabel?: (labelName: string) => void;
  selectedLabels?: string[];
}

/**
 * Format track duration from milliseconds to MM:SS format
 */
const formatDuration = (durationMs?: number): string => {
  if (!durationMs || durationMs <= 0 || !isFinite(durationMs)) return '';

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Get artist name from artist credits, handling various data structures
 */
const getArtistName = (artistCredits?: ArtistCredit[]): string => {
  if (!artistCredits || artistCredits.length === 0) return '';

  return artistCredits
    .map(credit => {
      if (credit.artist && credit.artist.name) {
        return credit.artist.name + (credit.joinphrase || '');
      }
      if (credit.name) {
        return credit.name + (credit.joinphrase || '');
      }
      return '';
    })
    .filter(Boolean)
    .join('');
};

/**
 * Calculate total duration of all tracks
 */
const getTotalDuration = (tracks: Track[]): number => {
  return tracks.reduce((total, track) => {
    const trackLength = track.length || 0;
    if (trackLength > 0 && isFinite(trackLength)) {
      return total + trackLength;
    }
    return total;
  }, 0);
};

/**
 * Format release date from YYYY-MM-DD to DD.MM.YYYY format
 */
const formatReleaseDate = (dateString?: string): string => {
  if (!dateString) return '';

  // Handle partial dates (e.g., "2023" or "2023-05")
  const parts = dateString.split('-');
  if (parts.length === 1) {
    // Only year provided
    return parts[0];
  } else if (parts.length === 2) {
    // Year and month provided
    return `${parts[1]}.${parts[0]}`;
  } else if (parts.length === 3) {
    // Full date provided
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
  }

  return dateString;
};

/**
 * Get all label names from release using the label processor
 * This automatically handles deduplication and filtering
 */
const getAllLabels = (album: { releaseDetails?: Release }): string => {
  const labels = extractLabelsFromAlbum(album as any);
  return labels.join(', ');
};

const TrackList: React.FC<TrackListProps> = ({ tracks, albumArtist, loading = false, releaseDetails, onToggleLabel, selectedLabels = [] }) => {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="bg-background-tertiary h-4 rounded-md w-3/4 mb-4"></div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="flex items-center space-x-2 flex-1">
                <div className="bg-background-tertiary h-3 w-6 rounded"></div>
                <div className="bg-background-tertiary h-3 rounded flex-1 max-w-xs"></div>
              </div>
              <div className="bg-background-tertiary h-3 w-12 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!tracks || tracks.length === 0) {
    if (loading) {
      return (
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-3">
            <div className="bg-background-tertiary h-3 w-16 rounded"></div>
            <div className="bg-background-tertiary h-3 w-20 rounded"></div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center space-x-2 flex-1">
                  <div className="bg-background-tertiary h-3 w-6 rounded"></div>
                  <div className="bg-background-tertiary h-3 rounded flex-1 max-w-xs"></div>
                </div>
                <div className="bg-background-tertiary h-3 w-12 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="text-text-tertiary text-sm text-center py-4">
        No track listing available
      </div>
    );
  }

  const totalDuration = getTotalDuration(tracks);
  const totalDurationFormatted = formatDuration(totalDuration);

  return (
    <div className="flex flex-col h-full">
      {/* Header with track count and total duration */}
      <div className="mb-3 flex-shrink-0">
        <div className="text-sm text-text-tertiary">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          {totalDurationFormatted && ` • ${totalDurationFormatted} min`}
        </div>
      </div>

      {/* Track listing - scrollable, takes remaining space */}
      <div className="space-y-1 flex-1 overflow-y-auto pr-2 min-h-0">
        {tracks.map((track, index) => {
          const trackArtist = getArtistName(track.artist_credit);
          const showArtist = trackArtist && trackArtist !== albumArtist;
          const duration = formatDuration(track.length);

          return (
            <div key={track.id || index} className="flex justify-between items-start gap-3 py-1">
              <div className="flex items-start space-x-2 min-w-0 flex-1">
                {/* Track number */}
                <span className="text-text-tertiary text-sm tabular-nums w-6 flex-shrink-0 text-left">
                  {track.number || (index + 1).toString()}
                </span>

                {/* Track title and artist */}
                <div className="min-w-0 flex-1">
                  <div className="text-text-primary text-sm font-medium truncate">
                    {track.title}
                  </div>
                  {showArtist && (
                    <div className="text-text-secondary text-xs truncate">
                      {trackArtist}
                    </div>
                  )}
                </div>
              </div>

              {/* Duration */}
              {duration && (
                <span className="text-text-tertiary text-sm tabular-nums flex-shrink-0 min-w-[3rem] text-right">
                  {duration}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Release information - bottom-aligned */}
      {releaseDetails && (releaseDetails.date || getAllLabels({ releaseDetails })) && (
        <div className="mt-3 flex-shrink-0">
          <div className="text-sm text-text-tertiary flex flex-wrap items-center gap-2">
            {releaseDetails.date && (
              <span>{formatReleaseDate(releaseDetails.date)}</span>
            )}
            {/* Clickable labels using label processor for deduplication */}
            {(() => {
              const labels = extractLabelsFromAlbum({ releaseDetails } as any);
              return labels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {labels.map((labelName, index) => {
                    const isSelected = selectedLabels.includes(labelName);
                    const isClickable = onToggleLabel !== undefined;

                    return isClickable ? (
                      <button
                        key={`${labelName}-${index}`}
                        onClick={() => onToggleLabel(labelName)}
                        className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-rose-400 text-white hover:bg-rose-400/80'
                            : 'bg-background-tertiary text-text-primary hover:bg-background'
                        }`}
                        title={isSelected ? `Remove ${labelName} filter` : `Add ${labelName} filter`}
                      >
                        {labelName}
                      </button>
                    ) : (
                      <span key={`${labelName}-${index}`}>
                        {labelName}
                        {index < labels.length - 1 && ', '}
                      </span>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackList;