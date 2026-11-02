/**
 * @ai-file api
 * @ai-description Plex Web links for the collection albums that are in the user's Plex library
 * @ai-dependencies plex-albums
 * @ai-features
 * - GET /api/plex/albums -> { enabled, albums: { <releaseGroupMbid>: <Plex Web URL> }, error? }
 * - enabled is false when PLEX_TOKEN is not set; the token itself is never part of the response
 */

import { NextResponse } from 'next/server';
import { getPlexAlbumLinks } from '@/lib/plex-albums';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getPlexAlbumLinks(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
