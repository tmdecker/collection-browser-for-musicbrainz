/**
 * @ai-file api
 * @ai-description Fetch user's MusicBrainz collections (authenticated)
 * @ai-dependencies getUserAgent utility, MusicBrainzCollectionList type
 * @ai-features
 * - Requires access token from cookies (401 if missing)
 * - Fetches user's collections (both public and private)
 * - Uses inc=user-collections parameter for private access
 * - Returns collections of every entity type (the Collections page groups them)
 * - Shares rate limiting with all MusicBrainz routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserAgent } from '@/utils/config/userAgent';
import { waitForRateLimit } from '@/lib/rate-limiter';
import { MusicBrainzCollectionList } from '@/types/auth';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

const MB_BASE_URL = 'https://musicbrainz.org/ws/2';

export async function GET(request: NextRequest) {
  try {
    // Get access token from cookie
    const accessToken = request.cookies.get('mb_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Rate limiting (shared with all MusicBrainz routes)
    await waitForRateLimit();

    // Get username from query params
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username required' },
        { status: 400 }
      );
    }

    // Construct MusicBrainz collections URL
    const mbUrl = new URL(`${MB_BASE_URL}/collection`);
    mbUrl.searchParams.set('editor', username);
    mbUrl.searchParams.set('inc', 'user-collections'); // Include private collections
    mbUrl.searchParams.set('fmt', 'json');

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(mbUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': getUserAgent(),
          'Authorization': `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`❌ MusicBrainz collections API error: ${response.status}`);
        return NextResponse.json(
          { error: `MusicBrainz API error: ${response.statusText}` },
          { status: response.status }
        );
      }

      const data: MusicBrainzCollectionList = await response.json();

      console.log(`✅ Fetched ${data.collections.length} collections`);

      return NextResponse.json({
        collections: data.collections,
        'collection-count': data.collections.length,
      });

    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`❌ MusicBrainz collections request timeout`);
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 408 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('❌ Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
