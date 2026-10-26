/**
 * @ai-file api
 * @ai-description Cached API endpoint for release group details
 * @ai-dependencies cache-manager, release-group-cache, release-store, music types
 * @ai-features
 * - Server-side cached endpoint for release group details
 * - Returns hydrated data immediately if cached (~50ms)
 * - Fetches from MusicBrainz + caches if not cached (~10-15s)
 * - Respects the shared MusicBrainz rate limit (user requests go ahead of prefetch)
 * - Joins a prefetch that is loading the same album instead of fetching it twice
 * - Stale albums (past 60 days) are served from the cache and refreshed in the background
 * - POST fetches the album again right away (after an edit on MusicBrainz) and drops its cached
 *   streaming links and cover images
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache/cache-manager';
import { ALBUM_DATA_TTL_SECONDS, releaseGroupCache } from '@/lib/cache/release-group-cache';
import { releaseStore } from '@/lib/cache/release-store';
import { getUserAgent } from '@/utils/config/userAgent';
import { waitForRateLimit } from '@/lib/rate-limiter';
import { Release, Track } from '@/types/music';
import { extractTracksFromMedia, selectPreferredRelease } from '@/utils/release-selection';
import { isMbid } from '@/utils/mbid-validation';
import { browseAllReleases, ReleaseBrowseError } from '@/lib/browse-releases';
import { releaseGroupFetchInFlight, withReleaseGroupFetch } from '@/lib/cache/release-group-fetches';
import { queueReleaseGroupRefresh } from '@/lib/prefetch/prefetch-service';
import { deleteRgStreamingLinks } from '@/lib/cache/streaming-links-cache';
import { forgetCachedImage } from '@/lib/image-cache';

// Force dynamic runtime
export const dynamic = 'force-dynamic';

// MusicBrainz API base URL
const MB_BASE_URL = 'https://musicbrainz.org/ws/2';



/**
 * Fetch a specific release with detailed information including tracks and labels
 */
async function fetchReleaseWithDetails(releaseId: string): Promise<Release> {
  await waitForRateLimit();

  const url = `${MB_BASE_URL}/release/${releaseId}?fmt=json&inc=recordings+labels+artist-credits+url-rels`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': getUserAgent(),
    },
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * The cached response for a fully cached release group, or null when it has to be fetched
 */
function cachedResponse(mbid: string): NextResponse | null {
  if (releaseGroupCache.isFullyCached(mbid)) {
    const hydratedRG = releaseGroupCache.getWithReleases(mbid);

    // Releases cached before browsing included url-rels have no relations: fetch them again once
    if (hydratedRG && hydratedRG.releases.every((release: Release) => release.relations)) {
      const rg = releaseGroupCache.get(mbid);
      // Stale data is served right away and refreshed in the background
      const stale = releaseGroupCache.isStale(mbid);
      if (stale) queueReleaseGroupRefresh(mbid);
      return NextResponse.json({
        success: true,
        data: hydratedRG,
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
 * Fetch a release group with all its releases from MusicBrainz and store it in the caches
 */
async function fetchReleaseGroup(mbid: string): Promise<NextResponse> {
  // Not cached - fetch from MusicBrainz
  console.log(`🔍 Fetching release group ${mbid} from MusicBrainz...`);

  // Step 1: Fetch release group basic info
  await waitForRateLimit();
  const rgResponse = await fetch(
    `${MB_BASE_URL}/release-group/${mbid}?fmt=json&inc=artist-credits+genres+tags+ratings`,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': getUserAgent(),
      },
    }
  );

  if (!rgResponse.ok) {
    return NextResponse.json(
      { error: `MusicBrainz API error: ${rgResponse.statusText}` },
      { status: rgResponse.status }
    );
  }

  const releaseGroup = await rgResponse.json();

  // Step 2: Fetch all releases (browse returns 100 per page)
  let releases: Release[];
  try {
    releases = await browseAllReleases(mbid, async url => {
      await waitForRateLimit();
      return fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': getUserAgent(),
        },
      });
    });
  } catch (error) {
    if (error instanceof ReleaseBrowseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  console.log(`📊 Fetched ${releases.length} releases for release group ${mbid}`);

  // Step 3: Select the preferred release
  const preferredRelease = selectPreferredRelease(releases);

  if (!preferredRelease) {
    console.warn(`❌ No releases found for release group ${mbid}`);

    // Store RG metadata without releases
    const now = Date.now();
    releaseGroupCache.set(mbid, {
      ...releaseGroup,
      releaseMbids: [],
      cover: `/api/coverart/release-group/${mbid}/front`,
      _cachedAt: now,
      _expiresAt: now + ALBUM_DATA_TTL_SECONDS * 1000,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...releaseGroup,
        releases: [],
        cover: `/api/coverart/release-group/${mbid}/front`,
      },
      metadata: {
        cached: false,
        cachedAt: null,
        source: 'api',
      },
    });
  }

  // Step 4: Fetch detailed release information with tracks and labels
  let tracklist: Track[] = [];
  let detailedRelease: Release | undefined;

  try {
    console.log(`📀 Fetching release details with tracks for ${preferredRelease.id}...`);
    detailedRelease = await fetchReleaseWithDetails(preferredRelease.id);
    tracklist = extractTracksFromMedia(detailedRelease.media || []);
    console.log(`✅ Extracted ${tracklist.length} tracks`);
  } catch (error) {
    console.warn(`❌ Failed to fetch release details for ${preferredRelease.id}:`, error);
  }

  // Step 5: Store in caches
  const now = Date.now();
  const expiresAt = now + ALBUM_DATA_TTL_SECONDS * 1000;

  // Store each release in the release store
  for (const release of releases) {
    releaseStore.set(release.id, {
      ...release,
      releaseGroupId: mbid,
      _cachedAt: now,
      _expiresAt: expiresAt,
    });
  }

  // Store detailed release if fetched
  if (detailedRelease) {
    releaseStore.set(detailedRelease.id, {
      ...detailedRelease,
      releaseGroupId: mbid,
      _cachedAt: now,
      _expiresAt: expiresAt,
    });
  }

  // Store release group with MBID references
  releaseGroupCache.set(mbid, {
    ...releaseGroup,
    releaseMbids: releases.map((r: Release) => r.id),
    bestReleaseMbid: preferredRelease.id,
    cover: `/api/coverart/release-group/${mbid}/front`,
    _cachedAt: now,
    _expiresAt: expiresAt,
  });

  console.log(`✅ Cached release group ${mbid} with ${releases.length} releases`);

  // Step 6: Return hydrated data
  const hydratedData = {
    ...releaseGroup,
    releases,
    bestRelease: detailedRelease || preferredRelease,
    tracklist,
    selectedReleaseId: preferredRelease.id,
    releaseDetails: detailedRelease,
    cover: `/api/coverart/release-group/${mbid}/front`,
  };

  return NextResponse.json({
    success: true,
    data: hydratedData,
    metadata: {
      cached: false,
      cachedAt: new Date(now).toISOString(),
      source: 'api',
    },
  });
}

/**
 * GET handler for /api/release-groups/[mbid]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  try {
    const { mbid } = await params;

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
  try {
    const { mbid } = await params;

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
    console.error('❌ Error refreshing release group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
