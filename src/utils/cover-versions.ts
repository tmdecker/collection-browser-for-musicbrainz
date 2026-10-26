/**
 * @ai-file utility
 * @ai-description Cover versions of albums refreshed by hand, so browsers load the new cover
 * @ai-dependencies React (useSyncExternalStore), localStorage
 * @ai-features
 * - /api/image responses are immutable for a year: a refreshed album's cover URL gets ?v=<time>
 * - Kept in localStorage, so the old cover does not come back from the browser cache after a reload
 * - Components re-render when a version changes (grid card and details panel at once)
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'mbCoverVersions';

let versions: Record<string, number> | null = null;
const listeners = new Set<() => void>();

const load = (): Record<string, number> => {
  if (versions) return versions;
  try {
    versions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, number>;
  } catch {
    versions = {};
  }
  return versions;
};

/**
 * Give an album's cover a new version (after a manual refresh)
 */
export const bumpCoverVersion = (releaseGroupMbid: string): void => {
  versions = { ...load(), [releaseGroupMbid]: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  } catch {
    // Storage blocked: the new version still applies until the page is reloaded
  }
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Current cover version of an album (undefined until it was refreshed)
 */
export const useCoverVersion = (releaseGroupMbid: string | undefined): number | undefined =>
  useSyncExternalStore(
    subscribe,
    () => (releaseGroupMbid ? load()[releaseGroupMbid] : undefined),
    () => undefined
  );
