/**
 * @ai-file api
 * @ai-description Streaming links of an album (release group), resolved and cached on the server
 * @ai-dependencies album-streaming-links
 * @ai-features
 * - GET /api/streaming-links?releaseGroup=<mbid>&country=DE
 * - MusicBrainz links of all releases plus barcode lookups (Deezer, Apple Music, Spotify, Tidal)
 * - One cached result per album and country (30 days, 1 hour after a failed lookup); prefetch fills the same entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAlbumStreamingLinks } from '@/lib/album-streaming-links';
import { isMbid } from '@/utils/mbid-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const releaseGroup = searchParams.get('releaseGroup');
  const country = searchParams.get('country') || 'DE';

  // Security: only real MBIDs and country codes become cache keys and MusicBrainz queries
  if (!isMbid(releaseGroup) || !/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: 'Invalid release group ID or country code' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getAlbumStreamingLinks(releaseGroup, country));
  } catch (error) {
    console.error(`❌ Streaming links failed for ${releaseGroup}:`, error);
    return NextResponse.json({ links: {}, fromCache: false, error: 'Lookup failed' }, { status: 502 });
  }
}
