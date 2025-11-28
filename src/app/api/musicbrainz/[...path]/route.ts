/**
 * @ai-file api
 * @ai-description API proxy for MusicBrainz that handles CORS, rate limiting, and OAuth authentication
 * @ai-dependencies Next.js server components, getUserAgent utility
 * @ai-features
 * - Proxies requests to MusicBrainz API to avoid CORS issues
 * - Rate limiting (1 request per 2 seconds per MusicBrainz guidelines)
 * - Automatically includes OAuth Bearer token from cookies when available
 * - Enables access to private collections for authenticated users
 * - AbortSignal for request timeouts with error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserAgent } from '@/utils/config/userAgent';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

// This is a proxy API route that will handle MusicBrainz API requests
// We implement it this way to avoid CORS issues when making client-side requests
// Following MusicBrainz API guidelines: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

// Add rate limiting to respect MusicBrainz guidelines
let lastRequestTime = 0;
const RATE_LIMIT_MS = 2000; // Allow 1 request per 2 seconds

const MB_BASE_URL = 'https://musicbrainz.org/ws/2';

// Simple GET proxy for MusicBrainz API
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();

    // Get the path from route params
    const mbPath = params.path.join('/');
    const searchParams = new URL(request.url).searchParams;

    // Construct the MusicBrainz URL
    const mbUrl = new URL(`${MB_BASE_URL}/${mbPath}`);
    mbUrl.search = searchParams.toString();

    // Check for access token (for authenticated requests to private collections)
    const accessToken = request.cookies.get('mb_access_token')?.value;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    // Build headers
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'User-Agent': getUserAgent(),
    };

    // Add OAuth token if available (enables access to private collections)
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch(mbUrl.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`❌ MusicBrainz request timeout: ${mbUrl.toString()}`);
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 408 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('❌ Error in MusicBrainz proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}