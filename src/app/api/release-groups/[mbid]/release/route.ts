/**
 * @ai-file api
 * @ai-description Choose which release an album (release group) shows: tracklist, labels, release date
 * @ai-dependencies release-choices, release-group-cache, release-store, release-group-fetch
 * @ai-features
 * - PUT { releaseId }: the album shows that release from now on (kept in the server database,
 *   for every browser and user of this server); DELETE: back to the app's own pick
 * - Only for logged-in users (MusicBrainz login cookie), only releases of this release group
 * - Loads the release's tracklist from MusicBrainz when it is not cached yet
 * - Drops the album's cached streaming links, so they are looked up again with the chosen release first
 * - Answers with the album as GET /api/release-groups/[mbid] does
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache/cache-manager';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { releaseStore } from '@/lib/cache/release-store';
import { releaseGroupFetchInFlight } from '@/lib/cache/release-group-fetches';
import { deleteRgStreamingLinks } from '@/lib/cache/streaming-links-cache';
import { clearReleaseChoice, getReleaseChoice, setReleaseChoice } from '@/lib/release-choices';
import { fetchReleaseDetails } from '@/lib/release-group-fetch';
import { isNetworkError } from '@/lib/network-errors';
import { isMbid } from '@/utils/mbid-validation';
import { selectPreferredRelease } from '@/utils/release-selection';

export const dynamic = 'force-dynamic';

const isLoggedIn = (request: NextRequest): boolean =>
  !!(request.cookies.get('mb_access_token')?.value || request.cookies.get('mb_refresh_token')?.value);

/**
 * Show this release (or the app's own pick when releaseId is null) for the album and answer with the album
 */
async function chooseRelease(request: NextRequest, mbid: string, releaseId: string | null): Promise<NextResponse> {
  if (!isMbid(mbid)) {
    return NextResponse.json({ error: 'Invalid release group ID' }, { status: 400 });
  }
  if (!isLoggedIn(request)) {
    return NextResponse.json({ error: 'Log in to choose the release' }, { status: 401 });
  }
  if (!cacheManager.isInitialized()) {
    await cacheManager.initialize();
  }

  // A fetch of this album that is running now would store its own pick after ours
  await releaseGroupFetchInFlight(mbid);

  const rg = releaseGroupCache.get(mbid);
  if (!rg) {
    return NextResponse.json({ error: 'This album is not loaded yet, please try again in a moment' }, { status: 409 });
  }
  if (releaseId !== null && !rg.releaseMbids.includes(releaseId)) {
    return NextResponse.json({ error: 'This release does not belong to the album' }, { status: 400 });
  }

  const target = releaseId ?? selectPreferredRelease(releaseStore.getBulk(rg.releaseMbids))?.id;
  if (!target) {
    return NextResponse.json({ error: 'This album has no releases' }, { status: 409 });
  }

  // Its tracklist comes with the release lookup, not with the browse of all releases
  const cachedRelease = releaseStore.get(target);
  if (!cachedRelease?.media?.some(medium => medium.tracks?.length)) {
    let detailed;
    try {
      detailed = await fetchReleaseDetails(target, 'high');
    } catch (error) {
      if (isNetworkError(error)) {
        return NextResponse.json({ error: 'MusicBrainz is unreachable, please try again in a moment' }, { status: 502 });
      }
      throw error;
    }
    if (!detailed) {
      return NextResponse.json({ error: 'MusicBrainz is busy, please try again in a moment' }, { status: 503 });
    }
    releaseStore.set(target, {
      ...detailed,
      releaseGroupId: mbid,
      _cachedAt: Date.now(),
      _expiresAt: rg._expiresAt ?? Date.now(),
    });
  }

  if (releaseId) {
    setReleaseChoice(mbid, releaseId);
  } else {
    clearReleaseChoice(mbid);
  }

  // Keep the album's remaining freshness: choosing a release is no reason to treat old data as new
  const freshUntil = releaseGroupCache.freshUntil(mbid);
  const ttlSeconds = freshUntil ? Math.max(60, Math.round((freshUntil - Date.now()) / 1000)) : undefined;
  releaseGroupCache.set(mbid, { ...rg, bestReleaseMbid: target }, ttlSeconds);
  deleteRgStreamingLinks(mbid);

  const hydrated = releaseGroupCache.getWithReleases(mbid);
  return NextResponse.json({
    success: true,
    data: { ...hydrated, releaseChoice: getReleaseChoice(mbid) },
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  const body = await request.json().catch(() => null);
  const releaseId = body?.releaseId;
  if (!isMbid(releaseId)) {
    return NextResponse.json({ error: 'Invalid release ID' }, { status: 400 });
  }
  try {
    return await chooseRelease(request, mbid, releaseId);
  } catch (error) {
    console.error(`❌ Choosing release ${releaseId} for ${mbid} failed:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  try {
    return await chooseRelease(request, mbid, null);
  } catch (error) {
    console.error(`❌ Resetting the release of ${mbid} failed:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
