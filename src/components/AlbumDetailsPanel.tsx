/**
 * @ai-file component
 * @ai-description Collapsible album details panel with cover art, metadata, genres, ratings, and tracklist
 * @ai-dependencies React, CoverArtImage, TrackList, StreamingLinksSection, StarRating, usePlexAlbums
 * @ai-features
 * - Docked inspector layout: one column (cover, metadata, tracklist) in a 400px side panel; full-screen view with Back on phones
 * - Compact header by default on tablet/desktop (small cover with type, year, title, artist, rating and links beside it);
 *   an expand icon on the cover switches to the full-width cover, and the choice is remembered
 * - Genre/tag display with optional ratings
 * - Streaming links integration
 * - "Open in Plex" link for albums in the user's Plex library (when Plex is configured)
 * - Progressive loading support
 * - Manual refresh of the album from MusicBrainz (after editing it there)
 * - Floating toolbar at the bottom (MusicBrainz, Reload, plus extraActions from the page); the cover keeps
 *   only the larger/smaller toggle and still links to MusicBrainz
 * - Tabs above the tracklist: Tracklist and Releases (pick the release shown, see ReleaseList); no tabs
 *   for albums with a single release. The tab goes back to Tracklist for every other album
 */

import React, { useState, useEffect } from 'react';
import { SiMusicbrainz } from 'react-icons/si';
import { BiChevronLeft, BiCollapseAlt, BiDockRight, BiExpandAlt, BiLock, BiRefresh } from 'react-icons/bi';
import { Toolbar, ToolbarButton } from './Toolbar';
import ReleaseList from './ReleaseList';
import CoverArtImage from './CoverArtImage';
import TrackList from './TrackList';
import StreamingLinksSection from './StreamingLinksSection';
import StarRating from './StarRating';
import { ReleaseGroup, StreamingLinks } from '@/types/music';
import { RatingDisplayMode } from '@/types/preferences';
import { orderedServiceLinks } from '@/utils/streaming-service-order';
import { usePreferences } from '@/hooks/usePreferences';
import { recheckPlexLink, usePlexAlbums } from '@/hooks/usePlexAlbums';

interface AlbumDetailsPanelProps {
  album: ReleaseGroup | null;
  albumDetails: ReleaseGroup | null;
  loading: boolean;
  /** Why the details could not be loaded; the tracklist shows it with a Try again button */
  detailsError?: string | null;
  onRetryDetails?: () => void;
  isOpen: boolean;
  onClose: () => void;
  useGenresOnly?: boolean;
  onToggleGenre?: (genreName: string) => void;
  onToggleLabel?: (labelName: string) => void;
  selectedGenres?: string[];
  selectedLabels?: string[];
  showRatings?: boolean;
  ratingDisplayMode?: RatingDisplayMode;
  isAuthenticated?: boolean;
  onRefreshAlbum?: (albumId: string) => Promise<boolean>;
  /** Show another release of the album (null: the app's own pick); resolves with an error message or null */
  onChooseRelease?: (albumId: string, releaseId: string | null) => Promise<string | null>;
  /** More toolbar buttons from the page (e.g. use as collection cover); style them with toolbarButtonClass */
  extraActions?: React.ReactNode;
}

type DetailsTab = 'tracklist' | 'releases';

// Whether the panel shows the full-width cover (true) or the compact header with a small cover (false).
// Remembered per browser; phones always show the full-width cover.
const COVER_EXPANDED_KEY = 'mb-details-cover-expanded';
const readCoverExpanded = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(COVER_EXPANDED_KEY) === 'true';
  } catch {
    return false;
  }
};

// The panel cover: the grid's 360px thumbnail (already in the browser cache) shows at once, and the
// sharp 1080px version fades in over it once loaded. Keyed by album, so a previous cover never lingers.
// The compact cover is small enough for the thumbnail, so the sharp version loads only when needed
// (on phones the cover is always full width).
const PanelCover: React.FC<{ mbid: string; title: string; compact?: boolean }> = ({ mbid, title, compact = false }) => {
  const [sharpLoaded, setSharpLoaded] = useState(false);
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setIsWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const needsSharp = !compact || !isWide;
  return (
    <>
      <CoverArtImage
        mbid={mbid}
        title={title}
        size={360}
        priority={true}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {needsSharp && (
        <CoverArtImage
          mbid={mbid}
          title={title}
          size={1080}
          priority={true}
          onLoad={() => setSharpLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90 ${sharpLoaded ? '' : '!opacity-0'}`}
        />
      )}
    </>
  );
};

const AlbumDetailsPanel: React.FC<AlbumDetailsPanelProps> = ({ album, albumDetails, loading, detailsError = null, onRetryDetails, isOpen, onClose, useGenresOnly = true, onToggleGenre, onToggleLabel, selectedGenres = [], selectedLabels = [], showRatings = true, ratingDisplayMode = 'average', isAuthenticated = false, onRefreshAlbum, onChooseRelease, extraActions }) => {
  const [streamingLinks, setStreamingLinks] = useState<StreamingLinks | null>(null);
  const [streamingLinksLoading, setStreamingLinksLoading] = useState(false);
  const [streamingLinksFromCache, setStreamingLinksFromCache] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  // Manual refresh from MusicBrainz, per album, so switching albums never shows another album's state
  const [refresh, setRefresh] = useState<{ albumId: string; status: 'running' | 'done' | 'failed' } | null>(null);
  const [coverExpanded, setCoverExpanded] = useState(readCoverExpanded);
  // The open tab, per album: another album always starts on the tracklist
  const [tabState, setTabState] = useState<{ albumId: string; tab: DetailsTab } | null>(null);
  const toggleCoverExpanded = () => {
    setCoverExpanded(expanded => {
      try {
        window.localStorage.setItem(COVER_EXPANDED_KEY, String(!expanded));
      } catch {
        // Storage unavailable (private mode): the choice just isn't remembered
      }
      return !expanded;
    });
  };

  // Use the detailed album data if available, otherwise fall back to basic album data
  const displayAlbum = albumDetails || album;
  const streamingPreferences = usePreferences().preferences.streaming;
  const streamingCountry = streamingPreferences.country;
  const plexLinks = usePlexAlbums();
  const plexUrl = displayAlbum ? plexLinks[displayAlbum.id] : undefined;
  // Plex and streaming links in the user's order; streaming links join once loaded
  const serviceLinks = orderedServiceLinks(
    streamingPreferences.serviceOrder,
    streamingPreferences.enabledServices,
    streamingLinksLoading ? null : streamingLinks,
    plexUrl
  );

  // An album's releases are cached once its details have loaded, so the server may only now be able
  // to link it to Plex: ask once more (no-op when Plex is off or the album already has a link)
  const detailsLoadedId = !loading && albumDetails?.tracklist ? albumDetails.id : null;
  useEffect(() => {
    if (detailsLoadedId) recheckPlexLink(detailsLoadedId);
  }, [detailsLoadedId]);

  // Tracklist is still on its way when the album has none yet, no details request is running and none failed
  const tracklistLoading = !!displayAlbum && !displayAlbum.tracklist && !loading && !detailsError;

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

  const refreshLabel = refreshStatus === 'running'
    ? 'Reloading from MusicBrainz…'
    : refreshStatus === 'done'
      ? 'Updated from MusicBrainz'
      : refreshStatus === 'failed'
        ? 'Reload failed, try again'
        : 'Reload from MusicBrainz (after editing it there)';

  // Tabs only when there is a choice of releases
  const releases = displayAlbum.releases ?? [];
  const hasReleaseTabs = releases.length > 1;
  const tab: DetailsTab = tabState?.albumId === displayAlbum.id ? tabState.tab : 'tracklist';

  // Compact header (tablet/desktop only): small cover with the facts beside it, vertically centred
  const compact = !coverExpanded;
  const headClass = compact ? 'flex flex-col gap-4 md:flex-row md:items-center md:pr-9' : 'flex flex-col gap-4 xl:pr-9';
  const coverWidthClass = compact ? 'w-full md:w-36 xl:w-[168px] md:shrink-0' : 'w-full';
  // Round icons on the cover, slightly smaller and closer to the edge on the compact cover
  const coverIconClass = compact
    ? 'w-8 h-8 md:w-7 md:h-7 grid place-items-center rounded-full bg-background/70'
    : 'w-8 h-8 grid place-items-center rounded-full bg-background/70';
  const inset = compact ? { tl: 'top-2 md:top-1.5', bl: 'bottom-2 md:bottom-1.5', l: 'left-2 md:left-1.5', r: 'right-2 md:right-1.5' } : { tl: 'top-2', bl: 'bottom-2', l: 'left-2', r: 'right-2' };
  const coverIconSize = compact ? 'w-5 h-5 md:w-4 md:h-4' : 'w-5 h-5';

  // Icon-only "close panel" button, never on the cover: right of the cover on large screens; on tablets
  // top-right beside the compact header (the expanded tablet layout uses Back instead, like phones).
  // Always shown on touch devices; with a mouse only while the panel is hovered or the button has keyboard focus
  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className={`hidden ${compact ? 'md:grid' : 'xl:grid'} absolute top-0 right-0 z-10 w-6 h-6 place-items-center text-text-secondary hover:text-text-primary transition-opacity focus-visible:opacity-100 ${isHovered ? '' : '[@media(hover:hover)]:opacity-0'}`}
      aria-label="Close album details"
      title="Close (Esc)"
    >
      <BiDockRight className="w-5 h-5" />
    </button>
  );

  return (
    <div
      className="h-full overflow-y-auto md:w-[var(--dock-width)] px-4 pt-4 md:px-8 md:pt-8 flex flex-col gap-4"
      role="region"
      aria-label="Album details panel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Content starts 32px from the panel's edges, like the grid covers; the close button sits top-right,
          in a narrow column that only the header row (cover and facts) leaves free */}
      <div className="relative w-full flex flex-col gap-4">
      {closeButton}
      {/* Phones (full-screen view) and the expanded tablet layout: closed with Back */}
      <button
        type="button"
        onClick={onClose}
        className={`${compact ? 'md:hidden' : 'xl:hidden'} self-start flex items-center gap-1 text-text-secondary hover:text-text-primary`}
      >
        <BiChevronLeft className="w-6 h-6" />
        Back
      </button>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-4">
          <div className={headClass}>
            {/* The cover is known before the details arrive, so show it right away */}
            <div className={`relative block aspect-square rounded-md overflow-hidden bg-background-tertiary ${coverWidthClass}`}>
              <PanelCover key={displayAlbum.id} mbid={displayAlbum.id} title={displayAlbum.title} compact={compact} />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="bg-background-tertiary h-7 rounded-md w-3/4"></div>
              <div className="bg-background-tertiary h-5 rounded-md w-1/2"></div>
            </div>
          </div>
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
          <div className={headClass}>
            {/* Cover: links to MusicBrainz */}
            <div className={`relative group/cover ${coverWidthClass}`}>
              <a
                href={`https://musicbrainz.org/release-group/${displayAlbum.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View on MusicBrainz"
                className="relative block aspect-square rounded-md overflow-hidden bg-background-tertiary w-full group cursor-pointer"
              >
                <PanelCover key={displayAlbum.id} mbid={displayAlbum.id} title={displayAlbum.title} compact={compact} />
              </a>
              {/* Larger / smaller cover, top-right (tablet and desktop; phones always show the full-width cover) */}
              <button
                type="button"
                onClick={toggleCoverExpanded}
                aria-label={compact ? 'Show large cover' : 'Show small cover'}
                title={compact ? 'Larger cover' : 'Smaller cover'}
                className={`hidden md:grid absolute ${inset.tl} ${inset.r} z-10 ${coverIconClass} text-white/80 hover:text-white transition-opacity focus-visible:opacity-100 group-hover/cover:opacity-100 [@media(hover:hover)]:opacity-0`}
              >
                {compact ? <BiExpandAlt className={coverIconSize} /> : <BiCollapseAlt className={coverIconSize} />}
              </button>
            </div>

            {/* Type and year label, title, artist, rating and links: beside the compact cover, under the large one */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                  {[displayAlbum.primary_type || 'Album', ...(displayAlbum.secondary_types || []), releaseYear]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <h2 className={`text-xl font-bold text-text-primary break-words ${compact ? '' : 'md:text-2xl'}`}>{displayAlbum.title}</h2>
                <p className={`text-text-secondary text-lg ${compact ? 'md:text-base' : ''}`}>{artistName}</p>
              </div>

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

              {/* Plex and streaming links, in the order chosen in Settings */}
              <div className="empty:hidden">
                <StreamingLinksSection links={serviceLinks} fromCache={streamingLinksFromCache} />
              </div>
            </div>
          </div>

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
                        : 'bg-background-tertiary text-text-primary hover:bg-white/15'
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

          {hasReleaseTabs && (
            <div className="mt-2 grid grid-cols-2 border-b border-background-tertiary" role="tablist" aria-label="Album details">
              {([['tracklist', 'Tracklist'], ['releases', 'Releases']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`details-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`details-tabpanel-${id}`}
                  onClick={() => setTabState({ albumId: displayAlbum.id, tab: id })}
                  className={`h-11 -mb-px border-b-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:bg-white/5 ${
                    tab === id ? 'border-primary text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {label}
                  {id === 'releases' && <span className="ml-1 text-xs text-text-tertiary tabular-nums">{releases.length}</span>}
                </button>
              ))}
            </div>
          )}

          {tab === 'releases' && hasReleaseTabs ? (
            <div className="min-w-0" role="tabpanel" id="details-tabpanel-releases" aria-labelledby="details-tab-releases">
              <ReleaseList
                key={displayAlbum.id}
                releases={releases}
                shownReleaseId={displayAlbum.selectedReleaseId ?? displayAlbum.releaseDetails?.id}
                choiceId={displayAlbum.releaseChoice ?? null}
                canChoose={isAuthenticated}
                onChoose={onChooseRelease ? releaseId => onChooseRelease(displayAlbum.id, releaseId) : undefined}
              />
            </div>
          ) : (
            <div
              className={`min-w-0 flex flex-col gap-3 ${hasReleaseTabs ? '' : 'mt-2'}`}
              {...(hasReleaseTabs ? { role: 'tabpanel', id: 'details-tabpanel-tracklist', 'aria-labelledby': 'details-tab-tracklist' } : {})}
            >
              <TrackList
                tracks={displayAlbum.tracklist}
                albumArtist={artistName}
                loading={tracklistLoading}
                error={displayAlbum.tracklist ? null : detailsError}
                onRetry={onRetryDetails}
                releaseDetails={displayAlbum.releaseDetails}
                onToggleLabel={onToggleLabel}
                selectedLabels={selectedLabels}
              />
            </div>
          )}
        </>
      )}
      </div>

      {/* Toolbar, right-aligned: floats at the bottom of the panel while it scrolls, rests below the content at the end.
          Level with the grid toolbar: the same sticky bottom and bottom margin as CollectionFootnote, and the panel
          has no bottom padding (a scroll container's padding would add to the sticky offset) */}
      <div className="sticky bottom-4 md:bottom-6 z-20 mt-auto pt-2 mb-4 md:mb-6 flex justify-end pointer-events-none">
        <Toolbar className="pointer-events-auto" label="Album toolbar" align="end">
          <ToolbarButton
            icon={<SiMusicbrainz />}
            label="Open on MusicBrainz"
            href={`https://musicbrainz.org/release-group/${displayAlbum.id}`}
          />
          {onRefreshAlbum && (
            <ToolbarButton
              icon={<BiRefresh />}
              label={refreshLabel}
              onClick={handleRefresh}
              disabled={refreshStatus === 'running'}
              status={refreshStatus === 'running' ? 'busy' : refreshStatus}
            />
          )}
          {extraActions}
        </Toolbar>
      </div>
    </div>
  );
};

export default AlbumDetailsPanel;