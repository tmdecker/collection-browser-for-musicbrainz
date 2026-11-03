/**
 * @ai-file page
 * @ai-description Start page: opens the collection or series used last, or the Collections page on a first visit
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePreferences } from '@/hooks/usePreferences';
import { collectionPath } from '@/utils/collection-routes';

export default function Home() {
  const { preferences, isInitialized } = usePreferences();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;
    const lastId = preferences.api.collectionId;
    // Keep the query (e.g. ?auth_success=true after logging in) for the next page
    const target = lastId
      ? collectionPath(preferences.metadata.entityType ?? 'collection', lastId)
      : '/collections';
    router.replace(`${target}${window.location.search}`);
    // Only on load: later changes to the stored collection come with their own navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  return <main className="min-h-screen bg-background" />;
}
