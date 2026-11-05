/**
 * @ai-file api
 * @ai-description OAuth2 login initiation endpoint
 * @ai-dependencies PKCE utilities, cookies
 * @ai-features PKCE generation, CSRF protection, redirect to MusicBrainz, remembers the starting page,
 *   ?force=1 re-prompts consent (to get a refresh token)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/utils/pkce';
import { OAUTH_FORCED_COOKIE, buildAuthorizationUrl } from '@/utils/oauth';
import { RETURN_TO_COOKIE, safeReturnTo } from '@/utils/return-to';

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

    // ?force=1 from the callback when MusicBrainz returned no refresh token
    const forceApproval = request.nextUrl.searchParams.get('force') === '1';

    // Build authorization URL
    const authUrl = buildAuthorizationUrl({
      clientId,
      redirectUri,
      codeChallenge,
      state,
      scope: ['profile', 'collection'], // Request profile and collection access
      forceApproval,
    });

    // Create response with redirect
    const response = NextResponse.redirect(authUrl);

    // Store code verifier in httpOnly cookie (5 min expiry)
    // secure flag defaults to true (HTTPS). Set COOKIE_SECURE=false only for HTTP deployments
    const cookieConfig = {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax' as const,
      maxAge: 300, // 5 minutes
      path: '/',
    };

    response.cookies.set('mb_code_verifier', codeVerifier, cookieConfig);
    response.cookies.set('mb_oauth_state', state, cookieConfig);
    // Page the login started from (?returnTo=/collections), so the callback can send the user back there
    response.cookies.set(RETURN_TO_COOKIE, safeReturnTo(request.nextUrl.searchParams.get('returnTo')), cookieConfig);
    // Remembers the forced consent, so the callback asks only once (no redirect loop)
    if (forceApproval) {
      response.cookies.set(OAUTH_FORCED_COOKIE, '1', cookieConfig);
    } else {
      response.cookies.delete(OAUTH_FORCED_COOKIE);
    }

    return response;
  } catch (error) {
    console.error('❌ Error initiating OAuth login:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth login' },
      { status: 500 }
    );
  }
}
