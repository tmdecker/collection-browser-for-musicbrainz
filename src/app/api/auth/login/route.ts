/**
 * @ai-file api
 * @ai-description OAuth2 login initiation endpoint
 * @ai-dependencies PKCE utilities, cookies
 * @ai-features PKCE generation, CSRF protection, redirect to MusicBrainz
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/utils/pkce';
import { buildAuthorizationUrl } from '@/utils/oauth';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.MUSICBRAINZ_OAUTH_CLIENT_ID;
    const redirectUri = process.env.MUSICBRAINZ_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'OAuth not configured. Please set MUSICBRAINZ_OAUTH_CLIENT_ID and MUSICBRAINZ_OAUTH_REDIRECT_URI environment variables.' },
        { status: 500 }
      );
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Generate state for CSRF protection
    const state = generateState();

    // Build authorization URL
    const authUrl = buildAuthorizationUrl({
      clientId,
      redirectUri,
      codeChallenge,
      state,
      scope: ['profile', 'collection'], // Request profile and collection access
    });

    // Create response with redirect
    const response = NextResponse.redirect(authUrl);

    // Store code verifier in httpOnly cookie (5 min expiry)
    response.cookies.set('mb_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
      path: '/',
    });

    // Store state in httpOnly cookie (5 min expiry)
    response.cookies.set('mb_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('❌ Error initiating OAuth login:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth login' },
      { status: 500 }
    );
  }
}
