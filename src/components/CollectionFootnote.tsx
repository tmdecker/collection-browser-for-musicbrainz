/**
 * @ai-file component
 * @ai-description Floating collection toolbar with the album count, homepage, MusicBrainz and reload
 * @ai-dependencies React, react-icons, Toolbar
 * @ai-features
 * - Sticks to the bottom-left corner of the content column while the page scrolls (position: sticky),
 *   and comes to rest below the last row at the end, so nothing stays hidden under it
 * - Solid pill (see Toolbar) whose count lines up with the covers; at the bottom of the window even when the
 *   page is short (the parent column is a full-height flex column, this sits at mt-auto)
 * - Count (the header shows the name), then round icon buttons, always visible with tooltips:
 *   a series' official homepage, MusicBrainz and Reload (spins while it runs)
 */

'use client';

import React from 'react';
import { SiMusicbrainz } from 'react-icons/si';
import { BiGlobe, BiRefresh } from 'react-icons/bi';
import { homepageDomain } from '@/utils/series-homepage';
import { Toolbar, ToolbarButton, ToolbarDivider } from './Toolbar';

interface CollectionFootnoteProps {
  /** Collection or series name, for the toolbar's accessible name */
  name: string;
  /** e.g. "1,226 release groups" or "10 of 1,226"; nothing while unknown */
  count?: string | null;
  /** Link to the shown entity on musicbrainz.org */
  musicBrainzUrl?: string;
  /** What the MusicBrainz link opens, for its tooltip ("this collection") */
  musicBrainzLabel?: string;
  /** Official homepage (series only) */
  homepageUrl?: string | null;
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
  onReload,
  isReloading = false,
}: CollectionFootnoteProps) {
  const hasButtons = !!(homepageUrl || musicBrainzUrl || onReload);
  if (!count && !hasButtons) return null;

  return (
    <div className="sticky bottom-4 md:bottom-6 z-20 mt-auto pt-2 mb-4 md:mb-6 mx-1.5 md:mx-[19px] flex pointer-events-none">
      <Toolbar className="pointer-events-auto" label={`${name} toolbar`}>
        {count && (
          <>
            <span className="pl-2 md:pl-[9px] pr-1 text-text-tertiary tabular-nums flex-shrink-0" aria-live="polite">
              {count}
            </span>
            {hasButtons && <ToolbarDivider />}
          </>
        )}
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
