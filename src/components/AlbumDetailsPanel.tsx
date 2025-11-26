/**
 * @ai-file component
 * @ai-description Collapsible album details panel with cover art, metadata, genres, ratings, and tracklist
 * @ai-dependencies React, CoverArtImage, TrackList, StreamingLinksSection, StarRating
 * @ai-features
 * - Three-column layout (cover, metadata, tracklist) - responsive stacking on mobile
 * - Genre/tag display with optional ratings
 * - Streaming links integration
 * - Progressive loading support
 */

import React, { useState, useEffect } from 'react';
import { SiMusicbrainz } from 'react-icons/si';
import { BiLock } from 'react-icons/bi';
import CoverArtImage from './CoverArtImage';
import TrackList from './TrackList';
import StreamingLinksSection from './StreamingLinksSection';
import StarRating from './StarRating';
import { ReleaseGroup, StreamingLinks } from '@/types/music';
import { StreamingServicePreferences, RatingDisplayMode } from '@/types/preferences';

interface AlbumDetailsPanelProps {
  album: ReleaseGroup | null;
  albumDetails: ReleaseGroup | null;
  loading: boolean;
  isOpen: boolean;
  onClose: () => void;
  useGenresOnly?: boolean;
  onToggleGenre?: (genreName: string) => void;
  onToggleLabel?: (labelName: string) => void;
  selectedGenres?: string[];
  selectedLabels?: string[];
  hasActiveFilters?: boolean;
  spotifyUseDesktopApp?: boolean;
  tidalUseDesktopApp?: boolean;
  appleMusicUseDesktopApp?: boolean;
  enabledStreamingServices?: StreamingServicePreferences;
  showRatings?: boolean;
  ratingDisplayMode?: RatingDisplayMode;
  isAuthenticated?: boolean;
}

const AlbumDetailsPanel: React.FC<AlbumDetailsPanelProps> = ({ album, albumDetails, loading, isOpen, onClose, useGenresOnly = true, onToggleGenre, onToggleLabel, selectedGenres = [], selectedLabels = [], hasActiveFilters = false, spotifyUseDesktopApp = false, tidalUseDesktopApp = false, appleMusicUseDesktopApp = false, enabledStreamingServices, showRatings = true, ratingDisplayMode = 'average', isAuthenticated = false }) => {
  const [tracklistLoading, setTracklistLoading] = useState(false);
  const [streamingLinks, setStreamingLinks] = useState<StreamingLinks | null>(null);
  const [streamingLinksLoading, setStreamingLinksLoading] = useState(false);
  const [streamingLinksFromCache, setStreamingLinksFromCache] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Use the detailed album data if available, otherwise fall back to basic album data
  const displayAlbum = albumDetails || album;

  // Monitor when tracklist becomes available
  useEffect(() => {
    if (displayAlbum) {
      if (!displayAlbum.tracklist && !loading) {
        setTracklistLoading(true);
      } else if (displayAlbum.tracklist) {
        setTracklistLoading(false);
      }
    }
  }, [displayAlbum, loading]);

  // Fetch streaming links independently in the background
  useEffect(() => {
    // Clear streaming links immediately when album changes (prevents flashing old data)
    setStreamingLinks(null);
    setStreamingLinksLoading(false);
    setStreamingLinksFromCache(false);

    // If no album, nothing to do
    if (!displayAlbum) {
      return;
    }

    // Only fetch if we have releaseDetails (which includes the release info needed)
    if (!displayAlbum.releaseDetails) {
      return; // Wait for releaseDetails to be available
    }

    // Create AbortController for cancellation
    const abortController = new AbortController();

    // Fetch streaming links in the background (don't block tracklist)
    const fetchLinks = async () => {
      setStreamingLinksLoading(true);
      try {
        console.log('🔗 Starting streaming links fetch in background');
        const { fetchStreamingLinksForAlbum } = await import('@/utils/streaming-links');
        const result = await fetchStreamingLinksForAlbum(
          displayAlbum,
          displayAlbum.releaseDetails!,
          undefined,
          abortController.signal
        );

        // Only update state if not aborted
        if (!abortController.signal.aborted) {
          console.log('✅ Streaming links fetched:', result.links, 'fromCache:', result.fromCache);
          setStreamingLinks(result.links);
          setStreamingLinksFromCache(result.fromCache);
        }
      } catch (error) {
        // Don't warn about aborted requests
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('❌ Failed to fetch streaming links:', error);
        }
      } finally {
        // Only update loading state if not aborted
        if (!abortController.signal.aborted) {
          setStreamingLinksLoading(false);
        }
      }
    };

    fetchLinks();

    // Cleanup: abort the fetch when dependencies change
    return () => {
      abortController.abort();
    };
  }, [displayAlbum?.id, displayAlbum?.releaseDetails]);

  if (!isOpen || !displayAlbum) return null;

  // Helper function to extract artist name regardless of data structure
  const getArtistName = () => {
    // First check if we have a flat album.artist value (might be from fallback or initial data)
    if ('artist' in displayAlbum && typeof displayAlbum.artist === 'string') {
      return displayAlbum.artist;
    }

    // Next try to extract from artist_credit array if it exists
    try {
      if (displayAlbum.artist_credit && Array.isArray(displayAlbum.artist_credit) && displayAlbum.artist_credit.length > 0) {
        return displayAlbum.artist_credit
          .map(credit => {
            // Try all possible paths to the artist name
            if (credit.artist && credit.artist.name) return credit.artist.name + (credit.joinphrase || '');
            if (credit.name) return credit.name + (credit.joinphrase || '');
            return '';
          })
          .filter(Boolean)
          .join('');
      }
    } catch (e) {
      console.error('Error extracting artist name from credits:', e);
    }

    // Third attempt: check if it's in the JSON-parsed string from debug output
    try {
      // The console log might have revealed a different structure
      if ('artist-credit' in displayAlbum && Array.isArray((displayAlbum as any)['artist-credit']) && (displayAlbum as any)['artist-credit'].length > 0) {
        return (displayAlbum as any)['artist-credit']
          .map((credit: any) => {
            if (credit.artist && credit.artist.name) return credit.artist.name + (credit.joinphrase || '');
            if (credit.name) return credit.name + (credit.joinphrase || '');
            return '';
          })
          .filter(Boolean)
          .join('');
      }
    } catch (e) {
      console.error('Error extracting artist name from hyphenated credits:', e);
    }

    return 'Unknown Artist';
  };

  const artistName = getArtistName();

  // Get release date with fallback options
  const getReleaseDate = () => {
    if (displayAlbum.first_release_date) return displayAlbum.first_release_date;
    if (displayAlbum.releases && displayAlbum.releases.length > 0 && displayAlbum.releases[0].date) {
      return displayAlbum.releases[0].date;
    }
    return '';
  };

  const releaseDate = getReleaseDate();

  // Get release year from date
  const getReleaseYear = () => {
    if (releaseDate && releaseDate.length >= 4) {
      return releaseDate.substring(0, 4);
    }
    return '';
  };

  const releaseYear = getReleaseYear();

  // Get track count from first release if available
  const getTrackCount = () => {
    if (!displayAlbum.releases || displayAlbum.releases.length === 0) {
      return null;
    }

    const firstRelease = displayAlbum.releases[0];

    // First try the direct track_count
    if (firstRelease.track_count && firstRelease.track_count > 0) {
      return firstRelease.track_count;
    }

    // Then try summing from media
    if (firstRelease.media && firstRelease.media.length > 0) {
      const totalTracks = firstRelease.media.reduce((sum, media) => {
        const mediaTrackCount = media.track_count || 0;
        return sum + (isFinite(mediaTrackCount) ? mediaTrackCount : 0);
      }, 0);

      return totalTracks > 0 ? totalTracks : null;
    }

    return null;
  };

  const trackCount = getTrackCount();

  // Get genres/tags based on useGenresOnly setting
  const getGenres = () => {
    const genreItems: Array<{ name: string; count: number }> = [];

    // Helper function to process genre/tag arrays (handles both string[] and object[] formats)
    const processGenreArray = (items: any[]): Array<{ name: string; count: number }> => {
      return items.map((item: any) => {
        if (typeof item === 'string') {
          // Backward compatibility: string format gets count of 0
          return { name: item, count: 0 };
        } else if (item && typeof item === 'object' && item.name) {
          // New format: object with name and count
          return { name: item.name, count: item.count || 0 };
        }
        return null;
      }).filter((item): item is { name: string; count: number } => item !== null);
    };

    // Choose which field to use based on useGenresOnly setting
    if (useGenresOnly) {
      // Use only official genres
      if (displayAlbum.genres && Array.isArray(displayAlbum.genres)) {
        genreItems.push(...processGenreArray(displayAlbum.genres));
      }

      // If we don't have genres in displayAlbum, check the original album
      if (genreItems.length === 0 && album && album !== displayAlbum) {
        if (album.genres && Array.isArray(album.genres)) {
          genreItems.push(...processGenreArray(album.genres));
        }
      }
    } else {
      // Use all tags as genres
      if (displayAlbum.tags && displayAlbum.tags.length > 0) {
        genreItems.push(...processGenreArray(displayAlbum.tags));
      }

      // If we don't have tags in displayAlbum, check the original album
      if (genreItems.length === 0 && album && album !== displayAlbum) {
        if (album.tags && album.tags.length > 0) {
          genreItems.push(...processGenreArray(album.tags));
        }
      }
    }

    // Remove duplicates by name, keeping the one with higher count
    const uniqueGenres = genreItems.reduce((acc, current) => {
      const existing = acc.find(item => item.name === current.name);
      if (existing) {
        // Keep the one with higher count
        if (current.count > existing.count) {
          const index = acc.indexOf(existing);
          acc[index] = current;
        }
      } else {
        acc.push(current);
      }
      return acc;
    }, [] as Array<{ name: string; count: number }>);

    // Sort by count (highest first) and return just the names
    return uniqueGenres
      .sort((a, b) => b.count - a.count)
      .map(item => item.name);
  };

  const genres = getGenres();

  // Calculate button position based on screen size
  const getButtonTop = () => {
    const baseOffset = 44; // Mobile/tablet offset

    return hasActiveFilters
      ? `calc(var(--header-height, 64px) + 48px + ${baseOffset}px)`
      : `calc(var(--header-height, 64px) + ${baseOffset}px)`;
  };

  const getButtonTopLg = () => {
    const lgOffset = 24; // Large screen offset
    return hasActiveFilters
      ? `calc(var(--header-height, 64px) + 48px + ${lgOffset}px)`
      : `calc(var(--header-height, 64px) + ${lgOffset}px)`;
  };

  return (
    <div
      className="fixed z-15 px-2 sm:px-3 pt-3 md:pt-0 left-0 right-0"
      style={{
        top: hasActiveFilters ? 'calc(var(--header-height, 64px) + var(--active-filters-height, 0px))' : 'var(--header-height, 64px)',
      }}
    >
      {/* Floating close button - positioned relative to sticky container */}
      <button
        onClick={onClose}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`absolute right-6 sm:right-6 top-[30px] md:top-3 z-30 p-1.5 rounded-full bg-background-tertiary/90 text-text-secondary transition-all shadow-lg backdrop-blur-sm lg:opacity-0 lg:pointer-events-none hover:bg-background hover:text-text-primary hover:scale-110 ${isHovered ? 'lg:!opacity-100 lg:!pointer-events-auto' : ''}`}
        aria-label="Close album details"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>


        <div
          className="max-h-[calc(100vh-var(--header-height)-2rem)] sm:max-h-none overflow-y-auto sm:overflow-visible rounded-3xl border border-white/10"
          role="region"
          aria-label="Album details panel"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            background: 'linear-gradient(180deg, rgba(26,26,26,0.98) 0%, rgba(26,26,26,0.95) 100%)',
            backdropFilter: 'blur(8px) saturate(1.2)',
            boxShadow: '0 1px 3px rgba(18,18,18,0.12), 0 1px 2px rgba(18,18,18,0.24)'
          }}
        >
        <div className="px-4 sm:px-6 pt-6 md:pt-[50px] pb-6 md:pb-[50px] relative">

        {loading ? (
          <div className="animate-pulse">
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              {/* Cover art skeleton */}
              <div className="flex-shrink-0 md:w-64">
                <div className="bg-background-tertiary aspect-square rounded-md w-64 h-64"></div>
              </div>

              {/* Metadata skeleton */}
              <div className="flex-1 min-w-0 flex flex-col md:h-64 justify-between">
                {/* Top section skeleton */}
                <div>
                  {/* Type skeleton */}
                  <div className="bg-background-tertiary h-4 rounded-md w-32 mb-2"></div>
                  <div className="bg-background-tertiary h-10 rounded-md w-3/4 mb-1"></div>
                  <div className="bg-background-tertiary h-8 rounded-md w-1/2 mb-3"></div>
                  {/* Genres skeleton */}
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bg-background-tertiary h-6 rounded-full w-16"></div>
                      ))}
                    </div>
                  </div>
                  {/* Track count skeleton */}
                  <div>
                    <div className="bg-background-tertiary h-3 rounded-md w-16 mb-2"></div>
                    <div className="bg-background-tertiary h-4 rounded-md w-8"></div>
                  </div>
                </div>

                {/* Bottom section skeleton */}
                <div>
                  {/* External link skeleton */}
                  <div>
                    <div className="bg-background-tertiary h-10 rounded-md w-40"></div>
                  </div>
                </div>
              </div>

              {/* Tracklist skeleton */}
              <div className="flex-1 min-w-0 md:max-w-md md:h-64 md:mt-0 mt-4">
                <div className="bg-background-tertiary h-4 rounded-md w-24 mb-4"></div>
                <div className="max-h-[232px] overflow-y-auto space-y-2">
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
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Cover Art + Metadata Container (side by side on tablet+) */}
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 lg:flex-1 items-center md:items-start">
              {/* Cover Art Section */}
              <div className="flex-shrink-0 md:w-64">
                <a
                  href={`https://musicbrainz.org/release-group/${displayAlbum.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on MusicBrainz"
                  className="relative block aspect-square rounded-md overflow-hidden bg-background-tertiary w-64 h-64 group cursor-pointer transition-transform hover:scale-[1.02]"
                  style={{
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), 0 8px 24px rgba(0, 0, 0, 0.18), 0 16px 48px rgba(0, 0, 0, 0.10)'
                  }}
                >
                  <CoverArtImage
                    mbid={displayAlbum.id}
                    title={displayAlbum.title}
                    size={500}
                    priority={true}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity group-hover:opacity-90"
                  />
                  {/* MusicBrainz icon in bottom-right corner */}
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <SiMusicbrainz className="w-6 h-6 text-white drop-shadow-lg" />
                  </div>
                </a>
              </div>

              {/* Metadata Section */}
              <div className="flex-1 min-w-0 flex flex-col justify-between text-center md:text-left" style={{ minHeight: '256px' }}>
                {/* Top section with main metadata */}
                <div className="flex flex-col items-center md:items-start">
                  {/* Type information - discrete and above title */}
                  <div className="text-sm text-text-tertiary mb-2">
                    {displayAlbum.primary_type || 'Album'}
                    {displayAlbum.secondary_types && displayAlbum.secondary_types.length > 0 && (
                      <span> • {displayAlbum.secondary_types.join(' • ')}</span>
                    )}
                    {releaseYear && <span> • {releaseYear}</span>}
                  </div>

                  <h4 className="text-xl md:text-2xl font-bold text-text-primary mb-1 line-clamp-2">{displayAlbum.title}</h4>
                  <p className="text-text-secondary text-lg md:text-xl mb-2">{artistName}</p>

                  {/* @ai Rating display with spacer to maintain genre position consistency
                      When ratings are hidden but rating data exists, an empty spacer maintains
                      the same vertical spacing so genre tags stay in their expected position */}
                  {displayAlbum.rating && (
                    <div className="mb-3">
                      {showRatings ? (
                        ratingDisplayMode === 'personal' ? (
                          !isAuthenticated ? (
                            <div className="text-sm text-text-tertiary italic flex items-center gap-1.5">
                              <BiLock className="text-base" />
                              <span>Log in to see your personal ratings</span>
                            </div>
                          ) : displayAlbum.rating.personal == null ? (
                            <div className="text-sm text-text-tertiary italic">
                              You haven't rated this album yet
                            </div>
                          ) : (
                            <StarRating
                              rating={displayAlbum.rating.personal}
                              mode="personal"
                              size="md"
                            />
                          )
                        ) : (
                          displayAlbum.rating.average != null && (
                            <StarRating
                              rating={displayAlbum.rating.average}
                              mode="average"
                              count={displayAlbum.rating.count}
                              size="md"
                            />
                          )
                        )
                      ) : (
                        <div className="h-6" />
                      )}
                    </div>
                  )}

                  {genres.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {genres.slice(0, 8).map((genre, index) => {
                          const isSelected = selectedGenres.includes(genre);
                          const isClickable = onToggleGenre !== undefined;

                          return isClickable ? (
                            <button
                              key={index}
                              onClick={() => onToggleGenre(genre)}
                              className={`px-3 py-1 rounded-full text-sm capitalize cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-primary text-white hover:bg-primary/80'
                                  : 'bg-background-tertiary text-text-primary hover:bg-background'
                              }`}
                              title={isSelected ? `Remove ${genre} filter` : `Add ${genre} filter`}
                            >
                              {genre}
                            </button>
                          ) : (
                            <span
                              key={index}
                              className="bg-background-tertiary text-text-primary px-3 py-1 rounded-full text-sm capitalize"
                            >
                              {genre}
                            </span>
                          );
                        })}
                        {genres.length > 8 && (
                          <span className="text-text-tertiary text-xs px-3 py-1">
                            +{genres.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {trackCount && (
                    <div className="mb-4">
                      <h5 className="text-xs font-semibold text-text-tertiary uppercase mb-1">Tracks</h5>
                      <p className="text-text-primary text-sm">{trackCount}</p>
                    </div>
                  )}
                </div>

                {/* Bottom section with streaming links*/}
                <div className="flex justify-center md:justify-start">
                  {/* Streaming Links */}
                  <StreamingLinksSection
                    streamingLinks={streamingLinks}
                    loading={streamingLinksLoading}
                    fromCache={streamingLinksFromCache}
                    spotifyUseDesktopApp={spotifyUseDesktopApp}
                    tidalUseDesktopApp={tidalUseDesktopApp}
                    appleMusicUseDesktopApp={appleMusicUseDesktopApp}
                    enabledServices={enabledStreamingServices}
                  />
                </div>
              </div>
            </div>

            {/* Tracklist Section - Stacked on tablet/mobile, side by side on large screens */}
            <div className="flex-1 min-w-0 lg:max-w-md lg:h-64 mt-6 lg:mt-0">
              <TrackList
                tracks={displayAlbum.tracklist}
                albumArtist={artistName}
                loading={tracklistLoading}
                releaseDetails={displayAlbum.releaseDetails}
                onToggleLabel={onToggleLabel}
                selectedLabels={selectedLabels}
              />
            </div>
          </div>
        )}
        </div>
        </div>
    </div>
  );
};

export default AlbumDetailsPanel;