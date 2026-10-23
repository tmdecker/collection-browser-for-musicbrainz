/**
 * @ai-file api
 * @ai-description API proxy for MusicBrainz that handles CORS, rate limiting, and OAuth authentication
 * @ai-dependencies Next.js server components, getUserAgent utility
 * @ai-features
 * - Proxies requests to MusicBrainz API to avoid CORS issues
 * - Rate limiting (shared queue, ~1 request per second per MusicBrainz guidelines)
 * - Automatically includes OAuth Bearer token from cookies when available
 * - Enables access to private collections for authenticated users
 * - AbortSignal for request timeouts with error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserAgent } from '@/utils/config/userAgent';
import { waitForRateLimit, backOffMusicBrainz } from '@/lib/rate-limiter';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

// This is a proxy API route that will handle MusicBrainz API requests
// We implement it this way to avoid CORS issues when making client-side requests
// Following MusicBrainz API guidelines: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

const MB_BASE_URL = 'https://musicbrainz.org/ws/2';

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 30000;

// Entities the app looks up through this proxy (collections list has its own route)
const ALLOWED_ENTITIES = new Set(['release-group', 'release', 'collection', 'series']);
const SAFE_SEGMENT = /^[A-Za-z0-9-]+$/;

// Simple GET proxy for MusicBrainz API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Security: only proxy the entity lookups the app uses. Arbitrary paths (including "..")
    // could otherwise reach other MusicBrainz endpoints with the user's OAuth token attached
    const segments = (await params).path;
    if (
      segments.length === 0 ||
      segments.length > 3 ||
      !ALLOWED_ENTITIES.has(segments[0]) ||
      !segments.every(segment => SAFE_SEGMENT.test(segment))
    ) {
      return NextResponse.json({ error: 'Unsupported MusicBrainz path' }, { status: 400 });
    }

    // Get the path from route params
    const mbPath = segments.join('/');
    const searchParams = new URL(request.url).searchParams;

    // Construct the MusicBrainz URL
    const mbUrl = new URL(`${MB_BASE_URL}/${mbPath}`);
    mbUrl.search = searchParams.toString();

    // Check for access token (for authenticated requests to private collections)
    const accessToken = request.cookies.get('mb_access_token')?.value;

    // Build headers
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'User-Agent': getUserAgent(),
    };

    // Add OAuth token if available (enables access to private collections)
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Retry after a 503 (MusicBrainz busy, shared back-off) or a network error, so a click
    // does not fail on a single hiccup; each attempt waits for its own rate-limit slot
    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await waitForRateLimit();
      try {
        response = await fetch(mbUrl.toString(), {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: 'no-store',
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  MusicBrainz request failed (${reason}), attempt ${attempt + 1}/${MAX_RETRIES + 1}: ${mbUrl.pathname}`);
        response = null;
        continue;
      }

      if (response.status !== 503) break;
      backOffMusicBrainz(response);
    }

    if (!response) {
      return NextResponse.json({ error: 'MusicBrainz is unreachable' }, { status: 502 });
    }

    if (!response.ok) {
      console.error(`❌ MusicBrainz API error: ${mbUrl.toString()} - Status: ${response.status}`);
      return NextResponse.json(
        { error: `MusicBrainz API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Error in MusicBrainz proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}