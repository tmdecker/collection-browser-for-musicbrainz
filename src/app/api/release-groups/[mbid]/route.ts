/**
 * @ai-file api
 * @ai-description Cached API endpoint for release group details
 * @ai-dependencies cache-manager, release-group-cache, release-store, music types
 * @ai-features
 * - Server-side cached endpoint for release group details
 * - Returns hydrated data immediately if cached (~50ms)
 * - Fetches from MusicBrainz + caches if not cached (~10-15s)
 * - Respects the shared MusicBrainz rate limit (user requests go ahead of prefetch)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache/cache-manager';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { releaseStore } from '@/lib/cache/release-store';
import { getUserAgent } from '@/utils/config/userAgent';
import { waitForRateLimit } from '@/lib/rate-limiter';
import { Release, Track } from '@/types/music';
import { extractTracksFromMedia, selectPreferredRelease } from '@/utils/release-selection';

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
 * GET handler for /api/release-groups/[mbid]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  try {
    const { mbid } = await params;

    // Initialize cache manager if needed
    if (!cacheManager.isInitialized()) {
      await cacheManager.initialize();
    }

    // Check if fully cached (release group + all releases)
    if (releaseGroupCache.isFullyCached(mbid)) {
      const hydratedRG = releaseGroupCache.getWithReleases(mbid);

      if (hydratedRG) {
        const rg = releaseGroupCache.get(mbid);
        return NextResponse.json({
          success: true,
          data: hydratedRG,
          metadata: {
            cached: true,
            cachedAt: rg?._cachedAt ? new Date(rg._cachedAt).toISOString() : null,
            source: 'cache',
          },
        });
      }
    }

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

    // Step 2: Fetch up to 100 releases using browse endpoint
    await waitForRateLimit();
    const releasesResponse = await fetch(
      `${MB_BASE_URL}/release?fmt=json&release-group=${mbid}&inc=media&limit=100`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': getUserAgent(),
        },
      }
    );

    if (!releasesResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch releases: ${releasesResponse.statusText}` },
        { status: releasesResponse.status }
      );
    }

    const releasesData = await releasesResponse.json();
    const releases = releasesData.releases || [];

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
        _expiresAt: now + 30 * 24 * 60 * 60 * 1000,
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
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

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
      streamingLinks: undefined, // Not fetched by this endpoint
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

  } catch (error) {
    console.error('❌ Error in release group endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
