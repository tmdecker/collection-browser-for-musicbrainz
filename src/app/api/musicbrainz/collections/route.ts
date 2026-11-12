/**
 * @ai-file api
 * @ai-description Fetch user's MusicBrainz collections (authenticated)
 * @ai-dependencies musicbrainz-fetch, MusicBrainzCollectionList type
 * @ai-features
 * - Requires access token from cookies (401 if missing)
 * - Fetches user's collections (both public and private)
 * - Uses inc=user-collections parameter for private access
 * - Returns collections of every entity type (the Collections page groups them)
 * - Shares rate limiting with all MusicBrainz routes; a 503 pauses all of them and is retried once
 */

import { NextRequest, NextResponse } from 'next/server';
import { MB_BASE_URL, musicBrainzFetch } from '@/lib/musicbrainz-fetch';
import { MusicBrainzCollectionList } from '@/types/auth';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';


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

    try {
      // A 503 (MusicBrainz busy) pauses all MusicBrainz requests for as long as it asks, then this
      // request tries once more (lib/musicbrainz-fetch)
      const response = await musicBrainzFetch(mbUrl, { accessToken, retries: 1 });

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
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
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
