import { Suspense } from 'react';
import CollectionsPage from '@/components/CollectionsPage';

// Your MusicBrainz collections, grouped by entity type; the search bar also opens a pasted MBID or link
export default function Collections() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <CollectionsPage />
    </Suspense>
  );
}
