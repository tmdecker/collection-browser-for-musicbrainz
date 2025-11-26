/**
 * @ai-file api
 * @ai-description OAuth2 callback endpoint
 * @ai-dependencies OAuth utilities, cookies
 * @ai-features CSRF protection, code exchange, token storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/utils/oauth';
import { setAuthCookies } from '@/utils/auth-cookies';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors (user denied, etc.)
    if (error) {
      console.error('❌ OAuth error:', error);
      const errorDescription = searchParams.get('error_description') || 'Authentication failed';
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(errorDescription)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/?auth_error=Missing authorization code or state', request.url)
      );
    }

    // Retrieve and verify state from cookie (CSRF protection)
    const storedState = request.cookies.get('mb_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('❌ State mismatch:', { storedState, receivedState: state });
      return NextResponse.redirect(
        new URL('/?auth_error=Invalid state parameter', request.url)
      );
    }

    // Retrieve code verifier from cookie
    const codeVerifier = request.cookies.get('mb_code_verifier')?.value;
    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL('/?auth_error=Missing code verifier', request.url)
      );
    }

    const clientId = process.env.MUSICBRAINZ_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MUSICBRAINZ_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.MUSICBRAINZ_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.redirect(
        new URL('/?auth_error=OAuth not configured', request.url)
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForToken({
      code,
      codeVerifier,
      clientId,
      clientSecret, // Optional - for Confidential clients (Web applications)
      redirectUri,
    });

    // Create response with redirect to home page
    const response = NextResponse.redirect(
      new URL('/?auth_success=true', request.url)
    );

    // Set all authentication cookies (uses centralized 90-day configuration)
    setAuthCookies(response, tokenResponse);

    // Clean up temporary cookies
    response.cookies.delete('mb_code_verifier');
    response.cookies.delete('mb_oauth_state');

    console.log('✅ OAuth authentication successful');
    return response;
  } catch (error) {
    console.error('❌ Error in OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
