/**
 * @ai-file hook
 * @ai-description Review links of the open album, and the user's review languages
 * @ai-dependencies /api/reviews, usePreferences, review-languages
 * @ai-features
 * - useReviewLinks: fetched when an album opens (cached on the server); null while loading or when the lookup
 *   failed, so the Reviews tab simply stays hidden; a new `reload` value fetches again (after a manual refresh)
 * - useReviewLanguages: the browser's languages while "Use my browser's languages" is on, else the user's list
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReviewLink } from '@/types/reviews';
import { usePreferences } from './usePreferences';
import { effectiveReviewLanguages } from '@/utils/review-languages';

export function useReviewLinks(albumId: string | undefined, reload: unknown = null): ReviewLink[] | null {
  const [result, setResult] = useState<{ key: string; links: ReviewLink[] } | null>(null);
  const key = albumId ? `${albumId}|${String(reload)}` : '';

  useEffect(() => {
    if (!albumId) return;
    const controller = new AbortController();
    fetch(`/api/reviews?${new URLSearchParams({ releaseGroup: albumId })}`, { signal: controller.signal })
      .then(response => (response.ok ? response.json() : null))
      .then((data: { links?: ReviewLink[] } | null) => {
        if (!controller.signal.aborted) setResult({ key, links: Array.isArray(data?.links) ? data.links : [] });
      })
      .catch(error => {
        if (!(error instanceof Error && error.name === 'AbortError')) console.warn('❌ Review links failed:', error);
      });
    return () => controller.abort();
  }, [albumId, key]);

  // Links of another album (or before this album's answer) are never shown
  return result?.key === key ? result.links : null;
}

const subscribeToLanguages = (onChange: () => void) => {
  window.addEventListener('languagechange', onChange);
  return () => window.removeEventListener('languagechange', onChange);
};
const browserLanguagesSnapshot = () => navigator.languages.join(',');
const noLanguagesOnServer = () => '';

export function useReviewLanguages(): string[] {
  const reviewPreferences = usePreferences().preferences.reviews;
  const browserLanguages = useSyncExternalStore(subscribeToLanguages, browserLanguagesSnapshot, noLanguagesOnServer);
  return effectiveReviewLanguages(reviewPreferences, browserLanguages ? browserLanguages.split(',') : []);
}
