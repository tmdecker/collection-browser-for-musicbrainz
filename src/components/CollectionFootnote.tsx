/**
 * @ai-file component
 * @ai-description Floating collection toolbar with the collection's name and count, homepage, MusicBrainz and reload
 * @ai-dependencies React, react-icons, Toolbar
 * @ai-features
 * - Sticks to the bottom-left corner of the content column while the page scrolls (position: sticky),
 *   and comes to rest below the last row at the end, so nothing stays hidden under it
 * - Solid pill (see Toolbar) whose text lines up with the covers; at the bottom of the window even when the
 *   page is short (the parent column is a full-height flex column, this sits at mt-auto)
 * - Name and count, then round icon buttons, always visible with tooltips: a series' official homepage,
 *   MusicBrainz and Reload (spins while it runs)
 * - Optional click handler on the name (scroll to top, close panels)
 */

'use client';

import React from 'react';
import { SiMusicbrainz } from 'react-icons/si';
import { BiGlobe, BiRefresh } from 'react-icons/bi';
import { homepageDomain } from '@/utils/series-homepage';
import { Toolbar, ToolbarButton, ToolbarDivider } from './Toolbar';

interface CollectionFootnoteProps {
  name: string;
  /** e.g. "1,226 release groups" or "10 of 1,226"; nothing while unknown */
  count?: string | null;
  /** Link to the shown entity on musicbrainz.org */
  musicBrainzUrl?: string;
  /** What the MusicBrainz link opens, for its tooltip ("this collection") */
  musicBrainzLabel?: string;
  /** Official homepage (series only) */
  homepageUrl?: string | null;
  onNameClick?: () => void;
  /** Reload the shown collection or series from MusicBrainz */
  onReload?: () => void;
  isReloading?: boolean;
}

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
  const hasButtons = !!(homepageUrl || musicBrainzUrl || onReload);

  return (
    <div className="sticky bottom-4 md:bottom-6 z-20 mt-auto pt-2 mb-4 md:mb-6 mx-1.5 md:mx-[19px] flex pointer-events-none">
      <Toolbar className="pointer-events-auto" label={`${name} toolbar`}>
        {onNameClick ? (
          <button
            type="button"
            onClick={onNameClick}
            className="min-w-0 truncate pl-2 md:pl-[9px] pr-1 font-medium text-text-primary hover:text-white/80 transition-colors"
            title="Return to top and close panels"
          >
            {name}
          </button>
        ) : (
          <span className="min-w-0 truncate pl-2 md:pl-[9px] pr-1 font-medium text-text-primary">{name}</span>
        )}
        {count && (
          <span className="ml-1 pr-1 text-text-tertiary tabular-nums flex-shrink-0 max-sm:hidden" aria-live="polite">
            {count}
          </span>
        )}
        {hasButtons && <ToolbarDivider />}
        {homepageUrl && (
          <ToolbarButton icon={<BiGlobe />} label={`Official homepage: ${homepageDomain(homepageUrl)}`} href={homepageUrl} />
        )}
        {musicBrainzUrl && (
          <ToolbarButton icon={<SiMusicbrainz />} label={`Open ${musicBrainzLabel} on MusicBrainz`} href={musicBrainzUrl} />
        )}
        {onReload && (
          <ToolbarButton
            icon={<BiRefresh />}
            label={isReloading ? 'Reloading from MusicBrainz…' : 'Reload from MusicBrainz'}
            onClick={onReload}
            disabled={isReloading}
            status={isReloading ? 'busy' : null}
          />
        )}
      </Toolbar>
    </div>
  );
}
