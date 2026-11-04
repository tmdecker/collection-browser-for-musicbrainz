/**
 * @ai-file component
 * @ai-description 2x2 cover mosaic for a collection or series, from release groups cached in this browser
 * @ai-dependencies React, CoverArtImage, IndexedDB cache (utils/db)
 * @ai-features
 * - Reads the collection's cached release group list (no MusicBrainz requests); picks the first four with a cover
 * - Same cover URLs and size as the grid, so the browser usually has them already
 * - Plain tiles (with an optional icon) when nothing is cached yet, e.g. a collection never opened in this browser
 */

import React, { useEffect, useState } from 'react';
import CoverArtImage from './CoverArtImage';
import { getCollectionMetadata, getReleaseGroup } from '@/utils/db';

interface CoverMosaicProps {
  /** Collection or series MBID whose cached release groups to show; nothing for a series collection */
  collectionId?: string;
  className?: string;
  /** Shown in the empty mosaic */
  emptyIcon?: React.ReactNode;
}

// Covers per id, shared by every mosaic on the page and kept for the session
const coverCache = new Map<string, string[]>();

async function loadCovers(collectionId: string): Promise<string[]> {
  const cached = coverCache.get(collectionId);
  if (cached) return cached;
  const covers: string[] = [];
  try {
    const metadata = await getCollectionMetadata(collectionId);
    for (const id of metadata?.albumIds.slice(0, 24) ?? []) {
      const rg = await getReleaseGroup(id);
      if (rg?.cover && rg.cover !== '/placeholder.svg') covers.push(rg.cover);
      if (covers.length === 4) break;
    }
  } catch {
    // No cache available (private window, blocked storage): show the empty mosaic
  }
  coverCache.set(collectionId, covers);
  return covers;
}

export default function CoverMosaic({ collectionId, className = '', emptyIcon }: CoverMosaicProps) {
  const [covers, setCovers] = useState<string[]>(() => (collectionId && coverCache.get(collectionId)) || []);

  useEffect(() => {
    if (!collectionId) return;
    let cancelled = false;
    loadCovers(collectionId).then(list => { if (!cancelled) setCovers(list); });
    return () => { cancelled = true; };
  }, [collectionId]);

  if (covers.length === 0) {
    return (
      <div className={`grid place-items-center bg-background-tertiary text-text-tertiary overflow-hidden ${className}`} aria-hidden="true">
        {emptyIcon}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-px bg-background overflow-hidden ${className}`} aria-hidden="true">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="relative bg-background-tertiary">
          {covers[i] && <CoverArtImage src={covers[i]} alt="" className="object-cover" />}
        </div>
      ))}
    </div>
  );
}
