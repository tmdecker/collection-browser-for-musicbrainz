/**
 * @ai-file api
 * @ai-description Fetches and caches metadata (genres/tags/ratings) for release groups from series
 * @ai-dependencies release-group-cache, rate-limiter, ratings utility
 * @ai-features
 * - Server-side metadata enhancement for series items
 * - Updates server-side cache with genres/tags/ratings
 * - Handles rate limiting for MusicBrainz API
 * - Returns cached data when available
 */

import { NextRequest, NextResponse } from 'next/server';
import { waitForRateLimit } from '@/lib/rate-limiter';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { extractRatingFromApiResponse } from '@/utils/ratings';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { mbid } = await request.json();

    if (!mbid || typeof mbid !== 'string') {
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
    await waitForRateLimit();

    const response = await fetch(
      `https://musicbrainz.org/ws/2/release-group/${mbid}?fmt=json&inc=genres+tags+ratings`,
      {
        headers: {
          'User-Agent': `${process.env.NEXT_PUBLIC_MUSICBRAINZ_APP_NAME} (${process.env.NEXT_PUBLIC_MUSICBRAINZ_CONTACT_EMAIL})`,
          'Accept': 'application/json',
        },
      }
    );

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
    console.error('Enhance metadata error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
