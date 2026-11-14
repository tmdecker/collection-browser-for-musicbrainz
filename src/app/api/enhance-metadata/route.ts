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
import { cacheManager } from '@/lib/cache/cache-manager';
import { lookUpReleaseItem } from '@/lib/pinned-release';
import { MusicBrainzResponseError } from '@/lib/release-group-fetch';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { releaseMbid } = body;
    let { mbid } = body;

    // A release item: its release group (asked for here when not known yet), format and cover
    let item: Awaited<ReturnType<typeof lookUpReleaseItem>> | undefined;
    if (releaseMbid !== undefined) {
      if (!isMbid(releaseMbid) || (mbid !== undefined && mbid !== null && !isMbid(mbid))) {
        return NextResponse.json({ error: 'Invalid mbid' }, { status: 400 });
      }
      if (!isMbid(mbid)) {
        if (!cacheManager.isInitialized()) await cacheManager.initialize();
        try {
          item = await lookUpReleaseItem(releaseMbid, 'low');
        } catch (error) {
          if (!(error instanceof MusicBrainzResponseError)) throw error;
          return NextResponse.json({ error: 'MB API error' }, { status: error.status });
        }
        mbid = item.releaseGroupId;
      }
    }

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
        rating: cached.rating,
        item,
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

    return NextResponse.json({ source: 'api', ...metadata, item });
  } catch (error) {
    if (isNetworkError(error)) {
      return NextResponse.json({ error: 'MusicBrainz is unreachable' }, { status: 502 });
    }
    console.error('Enhance metadata error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
