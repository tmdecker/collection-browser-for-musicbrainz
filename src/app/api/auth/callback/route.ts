/**
 * @ai-file api
 * @ai-description OAuth2 callback endpoint
 * @ai-dependencies OAuth utilities, cookies
 * @ai-features CSRF protection, code exchange, token storage, return to the page the login started from
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/utils/oauth';
import { setAuthCookies } from '@/utils/auth-cookies';
import { RETURN_TO_COOKIE, safeReturnTo, withAuthResult } from '@/utils/return-to';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

/**
 * Where to send the browser after login
 * Security: taken from the configured redirect URI (MusicBrainz only ever calls back to that exact
 * address), never from X-Forwarded-Host or Host, which any client can set to an attacker's site
 */
function getBaseUrl(request: NextRequest): string {
  const redirectUri = process.env.MUSICBRAINZ_OAUTH_REDIRECT_URI;
  if (redirectUri) {
    try {
      return new URL(redirectUri).origin;
    } catch {
      // Invalid configuration, fall back below
    }
  }
  return request.nextUrl.origin;
}

/**
 * Redirect back to the page the login started from, with the login result in the query
 * The temporary OAuth cookies are cleared on every outcome
 */
function redirectBack(
  request: NextRequest,
  baseUrl: string,
  key: 'auth_success' | 'auth_error',
  value: string
): NextResponse {
  const returnTo = safeReturnTo(request.cookies.get(RETURN_TO_COOKIE)?.value);
  const response = NextResponse.redirect(new URL(withAuthResult(returnTo, key, value), baseUrl));
  response.cookies.delete('mb_code_verifier');
  response.cookies.delete('mb_oauth_state');
  response.cookies.delete(RETURN_TO_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors (user denied, etc.)
    if (error) {
      console.error('❌ OAuth error:', error);
      const errorDescription = searchParams.get('error_description') || 'Authentication failed';
      return redirectBack(request, baseUrl, 'auth_error', errorDescription);
    }

    // Validate required parameters
    if (!code || !state) {
      return redirectBack(request, baseUrl, 'auth_error', 'Missing authorization code or state');
    }

    // Retrieve and verify state from cookie (CSRF protection)
    const storedState = request.cookies.get('mb_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      // Security: never log the state values themselves
      console.error(`❌ OAuth state mismatch (${storedState ? 'cookie differs' : 'no state cookie, check redirect URI host/port and COOKIE_SECURE'})`);
      return redirectBack(request, baseUrl, 'auth_error', 'Invalid state parameter');
    }

    // Retrieve code verifier from cookie
    const codeVerifier = request.cookies.get('mb_code_verifier')?.value;
    if (!codeVerifier) {
      return redirectBack(request, baseUrl, 'auth_error', 'Missing code verifier');
    }

    const clientId = process.env.MUSICBRAINZ_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MUSICBRAINZ_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.MUSICBRAINZ_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return redirectBack(request, baseUrl, 'auth_error', 'OAuth not configured');
    }

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForToken({
      code,
      codeVerifier,
      clientId,
      clientSecret, // Optional - for Confidential clients (Web applications)
      redirectUri,
    });

    // Back to the page the login started from (clears the temporary cookies)
    const response = redirectBack(request, baseUrl, 'auth_success', 'true');

    // Set all authentication cookies (uses centralized 90-day configuration)
    setAuthCookies(response, tokenResponse);

    console.log('✅ OAuth authentication successful');
    return response;
  } catch (error) {
    console.error('❌ Error in OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return redirectBack(request, baseUrl, 'auth_error', errorMessage);
  }
}
