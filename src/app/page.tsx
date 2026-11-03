/**
 * @ai-file page
 * @ai-description Start page: opens the collection or series used last, or the welcome screen on a first visit
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CollectionBrowser from '@/components/CollectionBrowser';
import { usePreferences } from '@/hooks/usePreferences';
import { collectionPath } from '@/utils/collection-routes';

export default function Home() {
  const { preferences, isInitialized } = usePreferences();
  const router = useRouter();
  // Decided once, when the stored preferences are loaded; loading a collection from the
  // welcome screen navigates by itself
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!isInitialized || showWelcome) return;
    const lastId = preferences.api.collectionId;
    if (lastId) {
      // Keep the query (e.g. ?auth_success=true after logging in) for the collection page
      router.replace(`${collectionPath(preferences.metadata.entityType ?? 'collection', lastId)}${window.location.search}`);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowWelcome(true);
    }
    // Only on load: later changes to the stored collection come with their own navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  if (!showWelcome) return <main className="min-h-screen bg-background" />;
  return <CollectionBrowser />;
}
