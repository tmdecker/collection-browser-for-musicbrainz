/**
 * @ai-file api
 * @ai-description Album details for one release (release items of release collections and release series)
 * @ai-dependencies cache-manager, pinned-release
 * @ai-features
 * - GET: the release's album in the shape of /api/release-groups/[mbid], with this release as the one shown
 *   (served from the server cache when the album is cached, else fetched from MusicBrainz)
 * - POST: fetch release group and release from MusicBrainz again (after an edit there)
 * - MusicBrainz busy or unreachable: its status (503) or 502 with a "try again" message
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache/cache-manager';
import { isNetworkError } from '@/lib/network-errors';
import { loadPinnedRelease } from '@/lib/pinned-release';
import { MusicBrainzResponseError } from '@/lib/release-group-fetch';
import { isMbid } from '@/utils/mbid-validation';

export const dynamic = 'force-dynamic';

async function respond(mbid: string, refresh: boolean): Promise<NextResponse> {
  // Security: only real MBIDs become cache keys, file names and MusicBrainz URL paths
  if (!isMbid(mbid)) {
    return NextResponse.json({ error: 'Invalid release ID' }, { status: 400 });
  }
  try {
    if (!cacheManager.isInitialized()) {
      await cacheManager.initialize();
    }
    const data = await loadPinnedRelease(mbid, { refresh });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof MusicBrainzResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isNetworkError(error)) {
      console.warn(`⚠️ MusicBrainz unreachable for release ${mbid}:`, error instanceof Error ? error.message : error);
      return NextResponse.json({ error: 'MusicBrainz is unreachable, please try again in a moment' }, { status: 502 });
    }
    console.error('❌ Error in release endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ mbid: string }> }) {
  return respond((await params).mbid, false);
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ mbid: string }> }) {
  return respond((await params).mbid, true);
}
