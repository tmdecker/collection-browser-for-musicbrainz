/**
 * @ai-file api
 * @ai-description Fetches and caches metadata (genres/tags/ratings) for release groups from series
 * @ai-dependencies release-group-cache, rate-limiter, ratings utility
 * @ai-features
 * - Server-side metadata enhancement for series items
 * - Updates server-side cache with genres/tags/ratings
 * - MusicBrainz requests through lib/musicbrainz-fetch (rate limit, timeout, 503 back-off and retries)
 * - Returns cached data when available
 */

import { NextRequest, NextResponse } from 'next/server';
import { MB_BASE_URL, musicBrainzFetch } from '@/lib/musicbrainz-fetch';
import { isNetworkError } from '@/lib/network-errors';
import { isMbid } from '@/utils/mbid-validation';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { extractRatingFromApiResponse } from '@/utils/ratings';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { mbid } = await request.json();

    if (!isMbid(mbid)) {
      return NextResponse.json({ error: 'Invalid mbid' }, { status: 400 });
    }

    // Check if already has metadata in server cache
    const cached = releaseGroupCache.get(mbid);
    if (cached?.genres?.length || cached?.tags?.length || cached?.rating) {
      console.log(`✅ Metadata cache hit for ${mbid}`);
      return NextResponse.json({
        source: 'cache',
        genres: cached.genres,
        tags: cached.tags,
        rating: cached.rating
      });
    }

    // Fetch from MusicBrainz API
    // Background enhancement: user requests go first
    const response = await musicBrainzFetch(`${MB_BASE_URL}/release-group/${mbid}?fmt=json&inc=genres+tags+ratings`, { priority: 'low' });

    if (!response.ok) {
      console.error(`MB API error for ${mbid}: ${response.status}`);
      return NextResponse.json({ error: 'MB API error' }, { status: response.status });
    }

    const data = await response.json();
    const metadata = {
      genres: data.genres || [],
      tags: data.tags || [],
      rating: extractRatingFromApiResponse(data)
    };

    // Update server-side cache
    releaseGroupCache.updateMetadata(mbid, metadata);
    console.log(`📥 Enhanced metadata for ${mbid} (${metadata.genres.length} genres, ${metadata.tags.length} tags, rating: ${metadata.rating ? 'yes' : 'no'})`);

    return NextResponse.json({ source: 'api', ...metadata });
  } catch (error) {
    if (isNetworkError(error)) {
      return NextResponse.json({ error: 'MusicBrainz is unreachable' }, { status: 502 });
    }
    console.error('Enhance metadata error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
