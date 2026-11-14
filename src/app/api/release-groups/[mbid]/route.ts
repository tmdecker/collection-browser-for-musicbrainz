/**
 * @ai-file api
 * @ai-description Cached API endpoint for release group details
 * @ai-dependencies cache-manager, release-group-cache, release-store, music types
 * @ai-features
 * - Server-side cached endpoint for release group details
 * - Returns hydrated data immediately if cached (~50ms)
 * - Fetches from MusicBrainz + caches if not cached (~10-15s)
 * - Respects the shared MusicBrainz rate limit (user requests go ahead of prefetch); a 503 from
 *   MusicBrainz pauses and is tried again (lib/musicbrainz-fetch) before the click gets an error
 * - Fetching and storing is shared with the prefetch (lib/release-group-fetch)
 * - Joins a prefetch that is loading the same album instead of fetching it twice
 * - Stale albums (past 60 days) are served from the cache and refreshed in the background
 * - Albums cached without url-rels (before 0.35.1) are served too and fetched again in the background
 * - MusicBrainz unreachable (network error, timeout): 502 with a "try again" message instead of a 500
 * - Every answer carries releaseChoice, the release picked in the Releases tab (see ./release)
 * - POST fetches the album again right away (after an edit on MusicBrainz) and drops its cached
 *   streaming links and cover images
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache/cache-manager';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { releaseStore } from '@/lib/cache/release-store';
import { Release } from '@/types/music';
import { isMbid } from '@/utils/mbid-validation';
import { releaseGroupFetchInFlight, withReleaseGroupFetch } from '@/lib/cache/release-group-fetches';
import { queueReleaseGroupRefresh } from '@/lib/prefetch/prefetch-service';
import { deleteRgStreamingLinks } from '@/lib/cache/streaming-links-cache';
import { forgetCachedImage } from '@/lib/image-cache';
import { isNetworkError } from '@/lib/network-errors';
import { coverUrlFor, fetchAndStoreReleaseGroup, MusicBrainzResponseError } from '@/lib/release-group-fetch';
import { getReleaseChoice } from '@/lib/release-choices';

// Force dynamic runtime
export const dynamic = 'force-dynamic';

/**
 * The cached response for a fully cached release group, or null when it has to be fetched
 */
function cachedResponse(mbid: string): NextResponse | null {
  if (releaseGroupCache.isFullyCached(mbid)) {
    const hydratedRG = releaseGroupCache.getWithReleases(mbid);

    // Releases cached before browsing included url-rels have no relations: still shown right away
    // (the tracklist is there) and fetched again in the background; without prefetch nothing would
    // ever refresh them, so they are fetched live then
    const missingLinks = !!hydratedRG && !hydratedRG.releases.every((release: Release) => release.relations);
    if (hydratedRG && !(missingLinks && process.env.PREFETCH_ENABLED === 'false')) {
      const rg = releaseGroupCache.get(mbid);
      // Stale data is served right away and refreshed in the background
      const stale = missingLinks || releaseGroupCache.isStale(mbid);
      if (stale) queueReleaseGroupRefresh(mbid);
      return NextResponse.json({
        success: true,
        data: { ...hydratedRG, releaseChoice: getReleaseChoice(mbid) },
        metadata: {
          cached: true,
          cachedAt: rg?._cachedAt ? new Date(rg._cachedAt).toISOString() : null,
          source: 'cache',
          stale,
        },
      });
    }
  }

  return null;
}

/**
 * 502 for a network failure to MusicBrainz (worth trying again), null for anything else (a bug: 500)
 */
function unreachableResponse(mbid: string, error: unknown): NextResponse | null {
  if (!isNetworkError(error)) return null;
  console.warn(`⚠️ MusicBrainz unreachable for release group ${mbid}:`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: 'MusicBrainz is unreachable, please try again in a moment' }, { status: 502 });
}

/**
 * Fetch a release group with all its releases from MusicBrainz, store it and answer with it
 * (a MusicBrainz error status, e.g. 503 after the retries or 404, is passed on with a message)
 */
async function fetchReleaseGroup(mbid: string): Promise<NextResponse> {
  console.log(`🔍 Fetching release group ${mbid} from MusicBrainz...`);
  let fetched;
  try {
    fetched = await fetchAndStoreReleaseGroup(mbid, 'high');
  } catch (error) {
    if (error instanceof MusicBrainzResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { releaseGroup, releases, preferredRelease, detailedRelease, tracklist } = fetched;
  const now = new Date().toISOString();
  const data = preferredRelease
    ? {
        ...releaseGroup,
        releases,
        bestRelease: detailedRelease || preferredRelease,
        tracklist,
        selectedReleaseId: preferredRelease.id,
        releaseChoice: getReleaseChoice(mbid),
        releaseDetails: detailedRelease,
        cover: coverUrlFor(mbid),
      }
    : { ...releaseGroup, releases: [], cover: coverUrlFor(mbid) };

  return NextResponse.json({
    success: true,
    data,
    metadata: { cached: false, cachedAt: preferredRelease ? now : null, source: 'api' },
  });
}

/**
 * GET handler for /api/release-groups/[mbid]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params;
  try {

    // Security: only real MBIDs become cache keys and MusicBrainz URL paths
    if (!isMbid(mbid)) {
      return NextResponse.json({ error: 'Invalid release group ID' }, { status: 400 });
    }

    // Initialize cache manager if needed
    if (!cacheManager.isInitialized()) {
      await cacheManager.initialize();
    }

    // Fully cached (release group + all releases)
    const cached = cachedResponse(mbid);
    if (cached) return cached;

    // The prefetch is loading this album right now: wait for it instead of fetching it a second time
    const inFlight = releaseGroupFetchInFlight(mbid);
    if (inFlight) {
      await inFlight;
      const joined = cachedResponse(mbid);
      if (joined) return joined;
    }

    return await withReleaseGroupFetch(mbid, () => fetchReleaseGroup(mbid));

  } catch (error) {
    const unreachable = unreachableResponse(mbid, error);
    if (unreachable) return unreachable;
    console.error('❌ Error in release group endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for /api/release-groups/[mbid]: fetch the album from MusicBrainz again, ignoring the cache
 * Used after editing the album on MusicBrainz (new cover art, new streaming links)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params;
  try {

    // Security: only real MBIDs become cache keys, file names and MusicBrainz URL paths
    if (!isMbid(mbid)) {
      return NextResponse.json({ error: 'Invalid release group ID' }, { status: 400 });
    }

    if (!cacheManager.isInitialized()) {
      await cacheManager.initialize();
    }

    // A fetch that started before the edit may finish after this refresh: let it finish first
    await releaseGroupFetchInFlight(mbid);

    console.log(`🔄 Manual refresh of release group ${mbid}`);
    const previousReleaseMbids = releaseGroupCache.get(mbid)?.releaseMbids ?? [];
    const response = await withReleaseGroupFetch(mbid, () => fetchReleaseGroup(mbid));
    if (!response.ok) return response;

    // Releases that were removed or merged on MusicBrainz no longer belong to this album
    const currentReleaseMbids = new Set(releaseGroupCache.get(mbid)?.releaseMbids ?? []);
    for (const releaseMbid of previousReleaseMbids) {
      if (!currentReleaseMbids.has(releaseMbid)) releaseStore.delete(releaseMbid);
    }

    // Streaming links are resolved again from the new releases on the next request; the cover is
    // downloaded again (the "no cover" marker is dropped too)
    deleteRgStreamingLinks(mbid);
    forgetCachedImage(`https://coverartarchive.org/release-group/${mbid}/front`);

    return response;
  } catch (error) {
    const unreachable = unreachableResponse(mbid, error);
    if (unreachable) return unreachable;
    console.error('❌ Error refreshing release group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
