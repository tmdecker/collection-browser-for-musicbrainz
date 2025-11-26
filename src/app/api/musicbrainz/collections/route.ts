/**
 * @ai-file api
 * @ai-description Fetch user's MusicBrainz collections (authenticated)
 * @ai-dependencies getUserAgent utility, MusicBrainzCollectionList type
 * @ai-features
 * - Requires access token from cookies (401 if missing)
 * - Fetches user's collections (both public and private)
 * - Uses inc=user-collections parameter for private access
 * - Filters by release_group type
 * - Shares rate limiting with main proxy (2-second interval)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserAgent } from '@/utils/config/userAgent';
import { MusicBrainzCollectionList, MusicBrainzCollection } from '@/types/auth';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

const MB_BASE_URL = 'https://musicbrainz.org/ws/2';

// Rate limiting (shared with main proxy)
let lastRequestTime = 0;
const RATE_LIMIT_MS = 2000;

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

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();

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

      // Filter for release_group collections only (note: MusicBrainz uses underscore in entity-type value)
      const releaseGroupCollections = data.collections.filter(
        (collection: MusicBrainzCollection) => collection['entity-type'] === 'release_group'
      );

      console.log(`✅ Fetched ${releaseGroupCollections.length} release_group collections`);

      return NextResponse.json({
        collections: releaseGroupCollections,
        'collection-count': releaseGroupCollections.length,
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
