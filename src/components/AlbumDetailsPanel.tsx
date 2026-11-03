/**
 * @ai-file component
 * @ai-description Collapsible album details panel with cover art, metadata, genres, ratings, and tracklist
 * @ai-dependencies React, CoverArtImage, TrackList, StreamingLinksSection, StarRating, usePlexAlbums
 * @ai-features
 * - Docked inspector layout: one column (cover, metadata, tracklist) in a 400px side panel; full-screen view with Back on phones
 * - Genre/tag display with optional ratings
 * - Streaming links integration
 * - "Open in Plex" link for albums in the user's Plex library (when Plex is configured)
 * - Progressive loading support
 * - Manual refresh of the album from MusicBrainz (after editing it there)
 */

import React, { useState, useEffect } from 'react';
import { SiMusicbrainz, SiPlex } from 'react-icons/si';
import { BiChevronLeft, BiDockRight, BiLock, BiRefresh } from 'react-icons/bi';
import CoverArtImage from './CoverArtImage';
import TrackList from './TrackList';
import StreamingLinksSection from './StreamingLinksSection';
import StarRating from './StarRating';
import { ReleaseGroup, StreamingLinks } from '@/types/music';
import { StreamingServicePreferences, RatingDisplayMode } from '@/types/preferences';
import { usePreferences } from '@/hooks/usePreferences';
import { recheckPlexLink, usePlexAlbums } from '@/hooks/usePlexAlbums';

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
  spotifyUseDesktopApp?: boolean;
  tidalUseDesktopApp?: boolean;
  appleMusicUseDesktopApp?: boolean;
  enabledStreamingServices?: StreamingServicePreferences;
  showRatings?: boolean;
  ratingDisplayMode?: RatingDisplayMode;
  isAuthenticated?: boolean;
  onRefreshAlbum?: (albumId: string) => Promise<boolean>;
}

const AlbumDetailsPanel: React.FC<AlbumDetailsPanelProps> = ({ album, albumDetails, loading, isOpen, onClose, useGenresOnly = true, onToggleGenre, onToggleLabel, selectedGenres = [], selectedLabels = [], spotifyUseDesktopApp = false, tidalUseDesktopApp = false, appleMusicUseDesktopApp = false, enabledStreamingServices, showRatings = true, ratingDisplayMode = 'average', isAuthenticated = false, onRefreshAlbum }) => {
  const [streamingLinks, setStreamingLinks] = useState<StreamingLinks | null>(null);
  const [streamingLinksLoading, setStreamingLinksLoading] = useState(false);
  const [streamingLinksFromCache, setStreamingLinksFromCache] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  // Manual refresh from MusicBrainz, per album, so switching albums never shows another album's state
  const [refresh, setRefresh] = useState<{ albumId: string; status: 'running' | 'done' | 'failed' } | null>(null);

  // Use the detailed album data if available, otherwise fall back to basic album data
  const displayAlbum = albumDetails || album;
  const streamingCountry = usePreferences().preferences.streaming.country;
  const plexLinks = usePlexAlbums();
  const plexUrl = displayAlbum ? plexLinks[displayAlbum.id] : undefined;

  // An album's releases are cached once its details have loaded, so the server may only now be able
  // to link it to Plex: ask once more (no-op when Plex is off or the album already has a link)
  const detailsLoadedId = !loading && albumDetails?.tracklist ? albumDetails.id : null;
  useEffect(() => {
    if (detailsLoadedId) recheckPlexLink(detailsLoadedId);
  }, [detailsLoadedId]);

  // Tracklist is still on its way when the album has none yet and no details request is running
  const tracklistLoading = !!displayAlbum && !displayAlbum.tracklist && !loading;

  // Clear streaming links as soon as the album, its release or the country changes, so old links
  // never flash (adjusting state during render instead of in the fetch effect)
  const streamingLinksKey = `${displayAlbum?.id ?? ''}|${displayAlbum?.releaseDetails?.id ?? ''}|${streamingCountry}`;
  const [shownStreamingLinksKey, setShownStreamingLinksKey] = useState(streamingLinksKey);
  if (streamingLinksKey !== shownStreamingLinksKey) {
    setShownStreamingLinksKey(streamingLinksKey);
    setStreamingLinks(null);
    setStreamingLinksLoading(false);
    setStreamingLinksFromCache(false);
  }

  // Fetch streaming links independently in the background
  useEffect(() => {
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
          displayAlbum.id,
          streamingCountry,
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
  // Refetch only when the album or its release changes, not on every metadata update to displayAlbum
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayAlbum?.id, displayAlbum?.releaseDetails, streamingCountry]);

  if (!isOpen || !displayAlbum) return null;

  const refreshStatus = refresh?.albumId === displayAlbum.id ? refresh.status : null;
  const handleRefresh = async () => {
    if (!onRefreshAlbum || refreshStatus === 'running') return;
    const albumId = displayAlbum.id;
    setRefresh({ albumId, status: 'running' });
    const ok = await onRefreshAlbum(albumId);
    setRefresh(current => (current?.albumId === albumId ? { albumId, status: ok ? 'done' : 'failed' } : current));
  };

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

  // Get release date from release-group first_release_date
  // Handle both normalized (first_release_date) and API format (first-release-date)
  const getReleaseDate = () => {
    return displayAlbum.first_release_date || (displayAlbum as any)['first-release-date'] || '';
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

  // Round "close panel" button, top-left over the cover: always shown on touch devices,
  // on devices with a mouse only while the panel is hovered or the button has keyboard focus
  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className={`hidden md:grid absolute top-2 left-2 z-10 w-9 h-9 place-items-center rounded-full bg-background-tertiary border border-white/15 text-text-secondary hover:text-text-primary hover:bg-[#3a3a3a] transition-opacity focus-visible:opacity-100 ${isHovered ? '' : '[@media(hover:hover)]:opacity-0'}`}
      aria-label="Close album details"
      title="Close (Esc)"
    >
      <BiDockRight className="w-5 h-5" />
    </button>
  );

  return (
    <div
      className="h-full overflow-y-auto md:w-[400px] p-4 md:p-5 flex flex-col gap-4"
      role="region"
      aria-label="Album details panel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Phones: the panel is a full-screen view, closed with Back */}
      <button
        type="button"
        onClick={onClose}
        className="md:hidden self-start flex items-center gap-1 text-text-secondary hover:text-text-primary"
      >
        <BiChevronLeft className="w-6 h-6" />
        Back
      </button>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-4">
          <div className="relative">
            <div className="bg-background-tertiary aspect-square rounded-md w-full max-w-[360px] mx-auto"></div>
            {closeButton}
          </div>
          <div className="bg-background-tertiary h-7 rounded-md w-3/4"></div>
          <div className="bg-background-tertiary h-5 rounded-md w-1/2"></div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-background-tertiary h-6 rounded-full w-16"></div>
            ))}
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-background-tertiary h-4 rounded"></div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Cover: links to MusicBrainz */}
          <div>
            <div className="relative w-full max-w-[360px] mx-auto">
              <a
                href={`https://musicbrainz.org/release-group/${displayAlbum.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View on MusicBrainz"
                className="relative block aspect-square rounded-md overflow-hidden bg-background-tertiary w-full group cursor-pointer"
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
              {closeButton}
            </div>
            {onRefreshAlbum && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshStatus === 'running'}
                title="Fetch this album again from MusicBrainz (after editing it there)"
                // Shown while the panel is hovered, focused by keyboard, or a refresh is running or reporting;
                // always shown on touch devices (no hover), so it stays reachable there
                className={`mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-[color,opacity] disabled:cursor-wait focus-visible:opacity-100 ${isHovered || refreshStatus ? '' : '[@media(hover:hover)]:opacity-0'}`}
              >
                <BiRefresh className={`text-base ${refreshStatus === 'running' ? 'animate-spin' : ''}`} />
                {refreshStatus === 'running'
                  ? 'Refreshing from MusicBrainz…'
                  : refreshStatus === 'done'
                    ? 'Updated from MusicBrainz'
                    : refreshStatus === 'failed'
                      ? 'Refresh failed, try again'
                      : 'Refresh from MusicBrainz'}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            {/* Title with type and year next to it, vertically centred */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <h2 className="text-xl md:text-2xl font-bold text-text-primary break-words min-w-0">{displayAlbum.title}</h2>
              <span className="text-sm text-text-tertiary whitespace-nowrap">
                {displayAlbum.primary_type || 'Album'}
                {displayAlbum.secondary_types && displayAlbum.secondary_types.length > 0 && (
                  <span> • {displayAlbum.secondary_types.join(' • ')}</span>
                )}
                {releaseYear && <span> • {releaseYear}</span>}
              </span>
            </div>
            <p className="text-text-secondary text-lg -mt-2">{artistName}</p>

            {displayAlbum.rating && showRatings && (
              <div>
                {ratingDisplayMode === 'personal' ? (
                  !isAuthenticated ? (
                    <div className="text-sm text-text-tertiary italic flex items-center gap-1.5">
                      <BiLock className="text-base" />
                      <span>Log in to see your personal ratings</span>
                    </div>
                  ) : displayAlbum.rating.personal == null ? (
                    <div className="text-sm text-text-tertiary italic">
                      You haven&apos;t rated this album yet
                    </div>
                  ) : (
                    <StarRating rating={displayAlbum.rating.personal} mode="personal" size="md" />
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
                )}
              </div>
            )}

            {genres.length > 0 && (
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
            )}

            {/* Plex link (albums in the user's Plex library) and streaming links */}
            <div className="flex flex-wrap gap-2">
              {plexUrl && (
                <a
                  href={plexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-6 h-6 text-text-secondary hover:text-white transition-colors duration-200"
                  title="Open in Plex"
                  aria-label="Open in Plex"
                >
                  <SiPlex className="w-6 h-6" />
                </a>
              )}
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

          <div className="mt-2 min-w-0">
            <TrackList
              tracks={displayAlbum.tracklist}
              albumArtist={artistName}
              loading={tracklistLoading}
              releaseDetails={displayAlbum.releaseDetails}
              onToggleLabel={onToggleLabel}
              selectedLabels={selectedLabels}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AlbumDetailsPanel;