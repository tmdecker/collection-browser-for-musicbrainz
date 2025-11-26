/**
 * @ai-file api
 * @ai-description API proxy for Odesli (song.link) API with rate limiting
 * @ai-dependencies Next.js server components, Odesli API
 * @ai-features
 * - Proxies requests to Odesli API to avoid CORS issues
 * - Rate limiting (10 requests per minute without API key, 6-second minimum delay)
 * - Client-side IndexedDB caching with 7-day TTL (managed by streaming-links.ts utility)
 * - Returns streaming links for multiple platforms
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 6000; // 6 seconds (10 requests per minute)

// Helper function to wait if needed for rate limiting
const enforceRateLimit = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const userCountry = searchParams.get('userCountry') || 'DE';

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Enforce rate limiting (critical for ToS compliance)
    await enforceRateLimit();

    // Build Odesli API URL
    const odesliUrl = new URL('https://api.song.link/v1-alpha.1/links');
    odesliUrl.searchParams.set('url', url);
    odesliUrl.searchParams.set('userCountry', userCountry);
    odesliUrl.searchParams.set('songIfSingle', 'true');

    const response = await fetch(odesliUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MusicBrainz-GUI/1.0 (https://github.com/user/musicbrainz-gui)',
      },
      // 30 second timeout
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      console.error(`❌ Odesli API error: ${odesliUrl.toString()} - Status: ${response.status}`);

      // Return empty response for client-side graceful handling
      return NextResponse.json({
        linksByPlatform: {},
        entitiesByUniqueId: {},
        userCountry,
        error: `API returned ${response.status}`
      });
    }

    const data = await response.json();

    // Add response headers for client-side caching (1 week)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=604800', // 1 week
        'X-Cache-Timestamp': Date.now().toString(),
      }
    });

  } catch (error: any) {
    console.error('❌ Error fetching streaming links:', error);

    // Return empty response instead of error to handle gracefully on client
    return NextResponse.json({
      linksByPlatform: {},
      entitiesByUniqueId: {},
      userCountry: 'US',
      error: error.message || 'Unknown error'
    });
  }
}