/**
 * @ai-file component
 * @ai-description Grid tile art for a collection, series or series collection: one cover cut to 3:2 across
 *   the middle, two faint half covers above and below, all on a dark tint taken from the first cover,
 *   and the name in a light shade of that tint
 * @ai-dependencies React, CoverArtImage, useMosaicCovers, cover-colour
 * @ai-features
 * - Same covers as the mosaic (first three of up to four candidates), so no extra requests
 * - Middle cover alternates between the left and right edge (flip), half covers on the opposite sides
 * - Colour read from the first cover once it has loaded; neutral grey until then and for grey covers
 * - Name centred in the bottom quarter, up to two lines
 */

import React, { useState } from 'react';
import CoverArtImage from './CoverArtImage';
import { useMosaicCovers, type MosaicSource } from './CoverMosaic';
import { coverColourOf, rememberedCoverColour, tileColours, type CoverColour } from '@/utils/cover-colour';

interface CoverMixProps extends MosaicSource {
  name: string;
  /** Middle cover on the right instead of the left */
  flip?: boolean;
  /** Shown in the middle band when there is no cover */
  emptyIcon?: React.ReactNode;
  className?: string;
}

export default function CoverMix({ name, flip = false, emptyIcon, className = '', ...source }: CoverMixProps) {
  const { shown, markFailed } = useMosaicCovers(source);
  const [main, top, bottom] = shown;
  const [colour, setColour] = useState<CoverColour | null | undefined>(undefined);
  const known = main ? (colour !== undefined ? colour : rememberedCoverColour(main)) : null;
  const tint = tileColours(known ?? null);

  const ghost = (cover: string | undefined, position: string) => cover && (
    <div className={`absolute w-1/2 h-1/4 overflow-hidden ${position}`}>
      <CoverArtImage src={cover} alt="" className="object-cover" onError={() => markFailed(cover)} />
      <div className="absolute inset-0" style={{ background: tint.background(0.84) }} />
    </div>
  );

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-md border border-white/10 [container-type:inline-size] transition-colors duration-300 ${className}`}
      style={{ background: tint.background() }}
    >
      {ghost(top, flip ? 'top-0 left-0' : 'top-0 right-0')}
      {ghost(bottom, flip ? 'bottom-0 right-0' : 'bottom-0 left-0')}
      {main ? (
        <div className={`absolute top-1/4 h-1/2 w-3/4 overflow-hidden ${flip ? 'right-0' : 'left-0'}`}>
          <CoverArtImage
            src={main}
            alt=""
            className="object-cover"
            onLoad={img => setColour(coverColourOf(img, main))}
            onError={() => markFailed(main)}
          />
          <div className="absolute inset-0" style={{ background: tint.background(0.3) }} />
        </div>
      ) : (
        <div className="absolute inset-x-0 top-1/4 h-1/2 grid place-items-center text-text-tertiary" aria-hidden="true">
          {emptyIcon}
        </div>
      )}
      <div className="absolute inset-x-[6.5cqw] top-3/4 bottom-0 flex items-center">
        <span
          className="text-[length:7.8cqw] font-bold leading-[1.1] line-clamp-2 [text-wrap:balance]"
          style={{ color: tint.title }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}
