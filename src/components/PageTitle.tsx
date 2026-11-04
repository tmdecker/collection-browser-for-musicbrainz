/**
 * @ai-file component
 * @ai-description Page title row above a page's content: name, count and a MusicBrainz link
 * @ai-dependencies React, react-icons
 * @ai-features
 * - Same 24px inset as the grid covers on md+ (18px on phones), 24px below the header
 * - Optional click handler on the name (scroll to top, close panels)
 * - Bare monochrome MusicBrainz icon, grey to white on hover
 */

import React from 'react';
import { SiMusicbrainz } from 'react-icons/si';

interface PageTitleProps {
  title: string;
  /** e.g. "1,226 release groups" or "10 of 1,226"; nothing while unknown */
  count?: string | null;
  /** Link to the shown entity on musicbrainz.org */
  musicBrainzUrl?: string;
  /** What the MusicBrainz link opens, for its tooltip ("this collection") */
  musicBrainzLabel?: string;
  onTitleClick?: () => void;
  /** Extra classes for the row, e.g. a different inset on pages without the grid */
  className?: string;
}

export default function PageTitle({
  title,
  count,
  musicBrainzUrl,
  musicBrainzLabel = 'this page',
  onTitleClick,
  className = 'px-[18px] pt-4 md:px-6 md:pt-6',
}: PageTitleProps) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-2 min-w-0 ${className}`}>
      <h1 className="min-w-0 text-[19px] md:text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text-primary">
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            className="text-left hover:text-white/80 transition-colors"
            title="Return to top and close panels"
          >
            {title}
          </button>
        ) : title}
      </h1>
      {/* Count and icon wrap together, so the icon never ends up alone on a line */}
      {(count || musicBrainzUrl) && (
        <span className="inline-flex items-baseline gap-3 whitespace-nowrap">
          {count && (
            <span className="text-sm text-text-tertiary tabular-nums" aria-live="polite">
              {count}
            </span>
          )}
          {musicBrainzUrl && (
            <a
              href={musicBrainzUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="self-center inline-flex text-text-secondary hover:text-white transition-colors duration-200"
              title={`Open ${musicBrainzLabel} on MusicBrainz`}
              aria-label={`Open ${musicBrainzLabel} on MusicBrainz`}
            >
              <SiMusicbrainz size={18} />
            </a>
          )}
        </span>
      )}
    </div>
  );
}
