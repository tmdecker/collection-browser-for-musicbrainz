/**
 * @ai-file component
 * @ai-description /collection/[mbid]: picks the screen for the collection's entity type
 * @ai-features
 * - Release group collection: the release group grid (CollectionBrowser)
 * - Series collection: the list of series in it (SeriesCollectionPage)
 * - Other entity types: a short "not supported yet" page
 * - The entity type is remembered in the browser, so it is looked up on MusicBrainz only once
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import CollectionBrowser from './CollectionBrowser';
import SeriesCollectionPage from './SeriesCollectionPage';
import { CollectionInfo, getCollectionInfo, loadCollectionInfo } from '@/utils/collection-info';

export default function CollectionRoute({ mbid }: { mbid: string }) {
  // undefined: not known yet; null: lookup failed (shown as a release group collection, whose page reports the error)
  const [info, setInfo] = useState<CollectionInfo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const known = getCollectionInfo(mbid);
    if (known) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInfo(known);
      return;
    }
    setInfo(undefined);
    loadCollectionInfo(mbid).then(result => {
      if (!cancelled) setInfo(result);
    });
    return () => { cancelled = true; };
  }, [mbid]);

  if (info === undefined) return <main className="min-h-screen bg-background" />;

  if (info?.entityType === 'series') {
    return (
      <Suspense fallback={<main className="min-h-screen bg-background" />}>
        <SeriesCollectionPage mbid={mbid} name={info.name} />
      </Suspense>
    );
  }

  if (info && info.entityType !== 'release_group') {
    return (
      <main className="min-h-screen bg-background p-6 text-text-secondary">
        <p className="mb-3">
          &ldquo;{info.name}&rdquo; is a {info.entityType.replace(/_/g, ' ')} collection. This app can only show release group and series collections so far.
        </p>
        <Link href="/collections" className="text-primary hover:text-primary-light">Back to Collections</Link>
      </main>
    );
  }

  return <CollectionBrowser route={{ entityType: 'collection', mbid }} />;
}
