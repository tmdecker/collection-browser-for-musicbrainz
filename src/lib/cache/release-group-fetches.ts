/**
 * @ai-file cache
 * @ai-description Release group fetches in flight, shared by the details route and the prefetch
 * @ai-features
 * - A click on an album the prefetch is loading waits for that fetch instead of starting its own
 * - The prefetch skips an album a click is already loading
 * - State on globalThis, so every route bundle sees the same fetches (like the caches)
 */

const store = globalThis as typeof globalThis & { __releaseGroupFetches?: Map<string, Promise<void>> };
const fetches = (): Map<string, Promise<void>> => (store.__releaseGroupFetches ??= new Map());

/**
 * The fetch currently loading this release group, if any (settles when it ends, never rejects)
 */
export const releaseGroupFetchInFlight = (mbid: string): Promise<void> | undefined => fetches().get(mbid);

/**
 * Run a fetch of this release group and mark it as in flight until it ends
 */
export async function withReleaseGroupFetch<T>(mbid: string, fetchFn: () => Promise<T>): Promise<T> {
  let done!: () => void;
  const marker = new Promise<void>(resolve => (done = resolve));
  fetches().set(mbid, marker);
  try {
    return await fetchFn();
  } finally {
    if (fetches().get(mbid) === marker) fetches().delete(mbid);
    done();
  }
}
