/**
 * @ai-file api
 * @ai-description Review links of an album (release group) from its MusicBrainz external links
 * @ai-dependencies review-links
 * @ai-features
 * - GET /api/reviews?releaseGroup=<mbid> answers { links: ReviewLink[] } in MusicBrainz order
 * - The client sorts them by the user's review languages; the server only adds each page's language
 * - 502 when MusicBrainz could not be asked (the Reviews tab then just stays hidden)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReviewLinks } from '@/lib/review-links';
import { isMbid } from '@/utils/mbid-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const releaseGroup = new URL(request.url).searchParams.get('releaseGroup');

  // Security: only real MBIDs become cache keys and MusicBrainz queries
  if (!isMbid(releaseGroup)) {
    return NextResponse.json({ error: 'Invalid release group ID' }, { status: 400 });
  }

  try {
    return NextResponse.json({ links: await getReviewLinks(releaseGroup) });
  } catch (error) {
    console.warn(`⚠️ Review links failed for ${releaseGroup}:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ links: [], error: 'Lookup failed' }, { status: 502 });
  }
}
