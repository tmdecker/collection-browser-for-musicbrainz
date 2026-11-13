/**
 * @ai-file component
 * @ai-description Album toolbar button: use this album's cover as the cover of the open collection or series
 * @ai-dependencies React, react-icons, collection-covers
 * @ai-features
 * - Pressed (violet, filled icon) when this album is the chosen cover; pressing again goes back to automatic
 * - Saved on the server, so the Collections page shows it in every browser
 * - Signed-in users only (the server refuses others): hidden when signed out
 */

'use client';

import { useState } from 'react';
import { BiImage, BiSolidImage } from 'react-icons/bi';
import { setChosenCover, useChosenCover } from '@/utils/collection-covers';

interface CollectionCoverButtonProps {
  collectionId: string;
  collectionName?: string;
  releaseGroupId: string;
  className?: string;
}

export default function CollectionCoverButton({ collectionId, collectionName, releaseGroupId, className = '' }: CollectionCoverButtonProps) {
  const chosen = useChosenCover(collectionId) === releaseGroupId;
  const [failed, setFailed] = useState(false);
  const name = collectionName || 'this collection';
  const label = failed
    ? 'Could not save the cover. Try again'
    : chosen ? `Cover of ${name}. Press to go back to automatic` : `Use as cover of ${name}`;

  const toggle = async () => {
    setFailed(false);
    setFailed(!(await setChosenCover(collectionId, chosen ? null : releaseGroupId)));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={chosen}
      title={label}
      aria-label={label}
      className={`${chosen ? 'text-primary-light' : failed ? 'text-red-400' : ''} ${className}`}
    >
      {chosen ? <BiSolidImage className="w-5 h-5" /> : <BiImage className="w-5 h-5" />}
    </button>
  );
}
