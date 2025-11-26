/**
 * @ai-file api
 * @ai-description API endpoint to resolve Apple Music geo links to final URLs
 * @ai-dependencies axios, Next.js server components
 * @ai-features
 * - Resolves geo.music.apple.com redirect chains to final destination URL
 * - Handles errors gracefully with fallback
 * - Enables music:// protocol conversion on client
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Validate that this is an Apple Music URL
    if (!url.includes('music.apple.com')) {
      return NextResponse.json(
        { error: 'Not an Apple Music URL' },
        { status: 400 }
      );
    }

    // Use axios.head to follow redirects without downloading content
    const response = await axios.head(url, {
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400, // Accept redirects
      timeout: 10000, // 10 second timeout
    });

    // Extract final URL from response
    // In Node.js, the final URL is in response.request.res.responseUrl
    const finalUrl = response.request?.res?.responseUrl || response.config?.url || url;

    return NextResponse.json({
      originalUrl: url,
      finalUrl: finalUrl,
      success: true,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=604800', // 1 week cache
      },
    });

  } catch (error: any) {
    console.error('❌ Error resolving Apple Music URL:', error.message);

    // Return original URL as fallback
    const url = new URL(request.url).searchParams.get('url') || '';
    return NextResponse.json({
      originalUrl: url,
      finalUrl: url, // Fallback to original URL
      success: false,
      error: error.message,
    });
  }
}
