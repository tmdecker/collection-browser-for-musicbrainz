/**
 * @ai-file component
 * @ai-description Floating footnote with the collection's name and count; opens to the series homepage, MusicBrainz link and reload
 * @ai-dependencies React, react-icons
 * @ai-features
 * - Sticks to the bottom-left corner of the content column while the page scrolls (position: sticky),
 *   and comes to rest below the last row at the end, so nothing stays hidden under it
 * - Solid pill one step lighter than the page (no transparency or blur, which made Chromium browsers flicker; no border or shadow),
 *   whose text lines up with the covers (32px from the left on md+, 18px on phones); at the bottom of the
 *   window even when the page is short (the parent column is a full-height flex column, this sits at mt-auto)
 * - Resting: only the name and the count. Hover or keyboard focus slides open the rest, in this order:
 *   a series' homepage domain ("bluenote.com"), "MusicBrainz", "Reload" (all grey to white on hover)
 * - Touch screens (no hover): a chevron; tapping the pill opens and closes it, a tap elsewhere closes it.
 *   They show icons instead of the words and hide the count while open, so the name keeps room on phones
 * - Stays open while a reload runs, so its spinner is visible
 * - Optional click handler on the name (scroll to top, close panels); on touch the first tap opens the pill
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SiMusicbrainz } from 'react-icons/si';
import { BiChevronRight, BiRefresh } from 'react-icons/bi';
import { homepageDomain } from '@/utils/series-homepage';

interface CollectionFootnoteProps {
  name: string;
  /** e.g. "1,226 release groups" or "10 of 1,226"; nothing while unknown */
  count?: string | null;
  /** Link to the shown entity on musicbrainz.org */
  musicBrainzUrl?: string;
  /** What the MusicBrainz link opens, for its tooltip ("this collection") */
  musicBrainzLabel?: string;
  /** Official homepage (series only), shown as its domain name */
  homepageUrl?: string | null;
  onNameClick?: () => void;
  /** Reload the shown collection or series from MusicBrainz */
  onReload?: () => void;
  isReloading?: boolean;
}

// Devices without hover (phones, tablets without a pointer): tap to open, icons instead of words
const canHover = () => typeof window === 'undefined' || window.matchMedia('(hover: hover)').matches;

// Words on devices with hover, icons on touch screens
const hoverOnly = '[@media(hover:none)]:hidden';
const touchOnly = 'hidden [@media(hover:none)]:inline-flex';

export default function CollectionFootnote({
  name,
  count,
  musicBrainzUrl,
  musicBrainzLabel = 'this collection',
  homepageUrl,
  onNameClick,
  onReload,
  isReloading = false,
}: CollectionFootnoteProps) {
  const [tappedOpen, setTappedOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const open = tappedOpen || isReloading;
  const hasMore = !!(homepageUrl || musicBrainzUrl || onReload);

  // A tap anywhere else closes the pill
  useEffect(() => {
    if (!tappedOpen) return;
    const onDown = (event: PointerEvent) => {
      if (pillRef.current && !pillRef.current.contains(event.target as Node)) setTappedOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [tappedOpen]);

  // Touch: a tap on the pill (not on a link or button inside it) opens or closes it
  const handlePillClick = (event: React.MouseEvent) => {
    if (!hasMore || canHover()) return;
    if ((event.target as HTMLElement).closest('a, button')) return;
    setTappedOpen(o => !o);
  };

  const handleNameClick = () => {
    if (hasMore && !canHover() && !open) {
      setTappedOpen(true);
      return;
    }
    onNameClick?.();
  };

  const linkClass = 'inline-flex items-center flex-shrink-0 text-text-tertiary hover:text-white transition-colors duration-200';

  return (
    <div className="sticky bottom-4 md:bottom-6 z-20 mt-auto pt-2 mb-4 md:mb-6 mx-1.5 md:mx-[19px] flex pointer-events-none">
      <div
        ref={pillRef}
        onClick={handlePillClick}
        data-open={open || undefined}
        className="group pointer-events-auto flex items-center min-w-0 max-w-full rounded-full bg-background-control pl-3 md:pl-[13px] pr-3 py-1.5 text-[13px] text-text-secondary whitespace-nowrap"
      >
        {onNameClick || hasMore ? (
          <button
            type="button"
            onClick={handleNameClick}
            className="min-w-0 truncate font-medium text-text-primary hover:text-white/80 transition-colors"
            title={onNameClick ? 'Return to top and close panels' : undefined}
          >
            {name}
          </button>
        ) : (
          <span className="min-w-0 truncate font-medium text-text-primary">{name}</span>
        )}
        {count && (
          <span
            className="ml-2 text-text-tertiary tabular-nums flex-shrink-0 [@media(hover:none)]:group-data-[open]:hidden"
            aria-live="polite"
          >
            {count}
          </span>
        )}

        {hasMore && (
          <>
            <BiChevronRight
              className={`${touchOnly} ml-1.5 flex-shrink-0 text-text-tertiary transition-transform group-data-[open]:rotate-180`}
              size={14}
              aria-hidden="true"
            />
            {/* Slides open to its own width: 0fr -> 1fr */}
            <div
              className="grid grid-cols-[0fr] flex-shrink-0 transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none
                [@media(hover:hover)]:group-hover:grid-cols-[1fr] group-focus-within:grid-cols-[1fr] group-data-[open]:grid-cols-[1fr]"
            >
              <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                <span className="ml-2.5 w-px h-3.5 bg-white/15 flex-shrink-0" aria-hidden="true" />
                {homepageUrl && (
                  <a
                    href={homepageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                    title={`Official homepage: ${homepageUrl}`}
                  >
                    {homepageDomain(homepageUrl)}
                  </a>
                )}
                {musicBrainzUrl && (
                  <a
                    href={musicBrainzUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                    title={`Open ${musicBrainzLabel} on MusicBrainz`}
                    aria-label={`Open ${musicBrainzLabel} on MusicBrainz`}
                  >
                    <span className={hoverOnly}>MusicBrainz</span>
                    <SiMusicbrainz className={touchOnly} size={14} />
                  </a>
                )}
                {onReload && (
                  <button
                    type="button"
                    onClick={onReload}
                    disabled={isReloading}
                    className={`${linkClass} disabled:cursor-default disabled:hover:text-text-tertiary`}
                    title="Reload from MusicBrainz"
                    aria-label={isReloading ? 'Reloading from MusicBrainz' : 'Reload from MusicBrainz'}
                  >
                    <span className={hoverOnly}>{isReloading ? 'Reloading…' : 'Reload'}</span>
                    <BiRefresh className={`${touchOnly} ${isReloading ? 'animate-spin' : ''}`} size={16} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
