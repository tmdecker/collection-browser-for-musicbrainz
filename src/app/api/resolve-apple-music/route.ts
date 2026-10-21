/**
 * @ai-file api
 * @ai-description API endpoint to resolve Apple Music geo links to final URLs
 * @ai-dependencies Next.js server components
 * @ai-features
 * - Resolves geo.music.apple.com redirect chains to final destination URL
 * - Only contacts Apple Music hosts (every redirect hop is validated, prevents SSRF)
 * - Handles errors gracefully with fallback
 * - Enables music:// protocol conversion on client
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10000;

/**
 * Security: Only allow HTTPS URLs on music.apple.com or its subdomains
 * Parses the URL instead of matching substrings, so hosts like
 * `127.0.0.1/?music.apple.com` or `music.apple.com.evil.example` are rejected
 */
function parseAppleMusicUrl(value: string, base?: string): URL | null {
  try {
    const parsed = new URL(value, base);
    const host = parsed.hostname.toLowerCase();
    const isAppleMusicHost = host === 'music.apple.com' || host.endsWith('.music.apple.com');

    if (parsed.protocol !== 'https:' || !isAppleMusicHost || parsed.username || parsed.password || parsed.port) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Follow redirects manually so each hop can be validated before it is requested
 */
async function resolveFinalUrl(startUrl: URL): Promise<string> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current.toString(), {
      method: 'HEAD',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return current.toString();
    }

    const next = parseAppleMusicUrl(location, current.toString());
    if (!next) {
      throw new Error('Redirect to non-Apple Music host blocked');
    }
    current = next;
  }

  throw new Error('Too many redirects');
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url).searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  // Validate that this is an Apple Music URL
  const appleMusicUrl = parseAppleMusicUrl(url);
  if (!appleMusicUrl) {
    return NextResponse.json(
      { error: 'Not an Apple Music URL' },
      { status: 400 }
    );
  }

  try {
    const finalUrl = await resolveFinalUrl(appleMusicUrl);

    return NextResponse.json({
      originalUrl: url,
      finalUrl,
      success: true,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=604800', // 1 week cache
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error resolving Apple Music URL:', message);

    // Return original URL as fallback
    return NextResponse.json({
      originalUrl: url,
      finalUrl: url, // Fallback to original URL
      success: false,
      error: 'Failed to resolve Apple Music URL',
    });
  }
}
