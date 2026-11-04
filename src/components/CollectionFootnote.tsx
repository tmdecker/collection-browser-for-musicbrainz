/**
 * @ai-file component
 * @ai-description Floating footnote with the collection's name, count and MusicBrainz link
 * @ai-dependencies React, react-icons
 * @ai-features
 * - Sticks to the bottom-left corner of the content column while the page scrolls (position: sticky),
 *   and comes to rest below the last row at the end, so nothing stays hidden under it
 * - Quiet solid dark pill (no transparency or blur, which made Chromium browsers flicker; no border or shadow),
 *   whose text lines up with the covers (32px from the left on md+, 18px on phones); at the bottom of the
 *   window even when the page is short (the parent column is a full-height flex column, this sits at mt-auto)
 * - Optional click handler on the name (scroll to top, close panels)
 * - Bare monochrome MusicBrainz icon, grey to white on hover
 */

import React from 'react';
import { SiMusicbrainz } from 'react-icons/si';

interface CollectionFootnoteProps {
  name: string;
  /** e.g. "1,226 release groups" or "10 of 1,226"; nothing while unknown */
  count?: string | null;
  /** Link to the shown entity on musicbrainz.org */
  musicBrainzUrl?: string;
  /** What the MusicBrainz link opens, for its tooltip ("this collection") */
  musicBrainzLabel?: string;
  onNameClick?: () => void;
}

export default function CollectionFootnote({
  name,
  count,
  musicBrainzUrl,
  musicBrainzLabel = 'this collection',
  onNameClick,
}: CollectionFootnoteProps) {
  return (
    <div className="sticky bottom-4 md:bottom-6 z-20 mt-auto pt-2 mb-4 md:mb-6 mx-1.5 md:mx-[19px] flex pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 min-w-0 max-w-full rounded-full bg-background pl-3 md:pl-[13px] pr-3 py-1.5 text-[13px] text-text-secondary whitespace-nowrap">
        {onNameClick ? (
          <button
            type="button"
            onClick={onNameClick}
            className="min-w-0 truncate font-medium text-text-primary hover:text-white/80 transition-colors"
            title="Return to top and close panels"
          >
            {name}
          </button>
        ) : (
          <span className="min-w-0 truncate font-medium text-text-primary">{name}</span>
        )}
        {count && (
          <span className="text-text-tertiary tabular-nums flex-shrink-0" aria-live="polite">
            {count}
          </span>
        )}
        {musicBrainzUrl && (
          <a
            href={musicBrainzUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-shrink-0 text-text-tertiary hover:text-white transition-colors duration-200"
            title={`Open ${musicBrainzLabel} on MusicBrainz`}
            aria-label={`Open ${musicBrainzLabel} on MusicBrainz`}
          >
            <SiMusicbrainz size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
