/**
 * @ai-file api
 * @ai-description API proxy for Odesli (song.link) API with server-side caching and rate limiting
 * @ai-dependencies Next.js server components, Odesli API, streamingLinksCache, odesli-rate-limiter
 * @ai-features
 * - Proxies requests to Odesli API to avoid CORS issues
 * - Server-side memory cache with 7-day TTL and disk persistence
 * - Shared rate limiter (6-second delay for Odesli ToS compliance)
 * - Cache key includes userCountry for region-specific links
 * - Returns streaming links for multiple platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { streamingLinksCache } from '@/lib/cache/streaming-links-cache';
import { waitForOdesliRateLimit } from '@/lib/odesli-rate-limiter';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

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

    // Check server-side cache first
    const cached = streamingLinksCache.getByUrl(url, userCountry);
    if (cached) {
      console.log(`✅ Server cache hit for streaming links: ${url}`);
      // Return cached Odesli response with cache headers
      return NextResponse.json(
        {
          linksByPlatform: cached.streamingLinks,
          entitiesByUniqueId: {},
          userCountry: cached.userCountry,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=604800',
            'X-Cache-Hit': 'true',
            'X-Cache-Timestamp': cached._cachedAt.toString(),
          }
        }
      );
    }

    // Odesli shut down keyless access (401 PUBLIC_API_ACCESS_DEPRECATED); without a key, skip the call
    // (and its 6 s rate-limit wait) so the client falls back to MusicBrainz links right away
    const apiKey = process.env.ODESLI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        linksByPlatform: {},
        entitiesByUniqueId: {},
        userCountry,
        disabled: true,
      });
    }

    console.log(`🌐 Server cache miss, fetching from Odesli API: ${url}`);

    // Enforce rate limiting (critical for ToS compliance)
    await waitForOdesliRateLimit();

    // Build Odesli API URL
    const odesliUrl = new URL('https://api.song.link/v1-alpha.1/links');
    odesliUrl.searchParams.set('url', url);
    odesliUrl.searchParams.set('userCountry', userCountry);
    odesliUrl.searchParams.set('songIfSingle', 'true');
    odesliUrl.searchParams.set('key', apiKey); // Server-only env var

    const response = await fetch(odesliUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MusicBrainz-GUI/1.0 (https://github.com/user/musicbrainz-gui)',
      },
      // 30 second timeout
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      console.error(`❌ Odesli API error for ${url} - Status: ${response.status}`); // Avoid logging the API key

      // Return empty response for client-side graceful handling
      return NextResponse.json({
        linksByPlatform: {},
        entitiesByUniqueId: {},
        userCountry,
        error: `API returned ${response.status}`
      });
    }

    const data = await response.json();

    // Store in server cache
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    streamingLinksCache.setByUrl(url, userCountry, {
      streamingLinks: data.linksByPlatform || {},
      sourceUrl: url,
      userCountry,
      _cachedAt: now,
      _expiresAt: now + sevenDays,
    });
    console.log(`💾 Stored in server cache: ${url}`);

    // Add response headers for client-side caching (1 week)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=604800', // 1 week
        'X-Cache-Hit': 'false',
        'X-Cache-Timestamp': now.toString(),
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