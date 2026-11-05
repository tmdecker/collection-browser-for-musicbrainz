/**
 * @ai-file api
 * @ai-description OAuth2 token refresh endpoint
 * @ai-dependencies OAuth utilities, cookies
 * @ai-features Token refresh, token rotation, cookie management
 */

import { NextRequest, NextResponse } from 'next/server';
import { isTokenRejected, refreshAccessToken } from '@/utils/oauth';
import { setAuthCookies, clearAuthCookies } from '@/utils/auth-cookies';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Retrieve refresh token from httpOnly cookie
    const refreshToken = request.cookies.get('mb_refresh_token')?.value;

    if (!refreshToken) {
      console.warn('⚠️ Token refresh without refresh token cookie');
      return NextResponse.json(
        { error: 'No refresh token found' },
        { status: 401 }
      );
    }

    const clientId = process.env.MUSICBRAINZ_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MUSICBRAINZ_OAUTH_CLIENT_SECRET;

    if (!clientId) {
      return NextResponse.json(
        { error: 'OAuth not configured' },
        { status: 500 }
      );
    }

    // Refresh the access token
    const tokenResponse = await refreshAccessToken({
      refreshToken,
      clientId,
      clientSecret, // Optional - for Confidential clients (Web applications)
    });

    // Calculate token expiry for JSON response
    const expiresAt = Date.now() + tokenResponse.expires_in * 1000;

    // Create response with token metadata only
    // Security: never return the access token itself - it stays in the httpOnly cookie
    const response = NextResponse.json({
      expires_at: expiresAt,
      scope: tokenResponse.scope,
    });

    // Set all authentication cookies (uses centralized 90-day configuration)
    setAuthCookies(response, tokenResponse);

    console.log('✅ Token refreshed successfully');
    return response;
  } catch (error) {
    console.error('❌ Error refreshing token:', error);

    // Network errors, rate limits and server errors: keep the refresh token for the next try
    // (clearing it here logged the user out for good)
    if (!isTokenRejected(error)) {
      return NextResponse.json(
        { error: 'Token refresh temporarily failed' },
        { status: 503 }
      );
    }

    // MusicBrainz rejected the refresh token: clear all auth cookies
    const response = NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 401 }
    );

    clearAuthCookies(response);

    return response;
  }
}
