/**
 * @ai-file utility
 * @ai-description Covers chosen for collections and series, read once from the server and shared by every tile
 * @ai-dependencies fetch (/api/collection-covers), React
 * @ai-features
 * - One request per page load for the whole map; tiles and the album toolbar re-render when it arrives or changes
 * - Choosing or resetting updates the map at once and goes back to the old value if the server refuses
 */

import { useSyncExternalStore } from 'react';

type Covers = Record<string, string>;

let covers: Covers = {};
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const publish = (next: Covers) => {
  covers = next;
  listeners.forEach(listener => listener());
};

function load(): Promise<void> {
  loading ??= fetch('/api/collection-covers')
    .then(response => (response.ok ? response.json() : { covers: {} }))
    .then((data: { covers?: Covers }) => publish({ ...data.covers, ...covers }))
    .catch(() => { loading = null; }); // Offline or server down: automatic covers, asked again next time
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => { listeners.delete(listener); };
}

/** Release group chosen as the cover of a collection or series, or undefined for automatic */
export function useChosenCover(collectionId: string | undefined): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (collectionId ? covers[collectionId] : undefined),
    () => undefined,
  );
}

/** Choose a release group as the cover (null: back to automatic); resolves false if the server refused */
export async function setChosenCover(collectionId: string, releaseGroupId: string | null): Promise<boolean> {
  const before = covers;
  const next = { ...covers };
  if (releaseGroupId) next[collectionId] = releaseGroupId;
  else delete next[collectionId];
  publish(next);
  try {
    const response = await fetch(`/api/collection-covers/${collectionId}`, releaseGroupId
      ? { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ releaseGroupId }) }
      : { method: 'DELETE' });
    if (response.ok) return true;
  } catch { /* fall through */ }
  publish(before);
  return false;
}
