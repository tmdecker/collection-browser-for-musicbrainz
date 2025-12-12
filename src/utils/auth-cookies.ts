/**
 * @ai-file utility
 * @ai-description Centralized authentication cookie management for OAuth2 sessions
 * @ai-features 90-day session cookies, unified setting/clearing helpers
 */

import { NextResponse } from 'next/server';

// 90-day session duration (in seconds) - CRITICAL for session persistence
export const SESSION_MAX_AGE = 90 * 24 * 60 * 60;

/**
 * Base cookie configuration for all auth cookies
 * All auth cookies MUST use 90-day maxAge to ensure proper session persistence
 * secure flag defaults to true (HTTPS). Set COOKIE_SECURE=false only for HTTP deployments
 */
export const AUTH_COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== 'false',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE,
};

/**
 * Cookie configuration for the token expiry timestamp cookie
 * This needs to be readable by JavaScript (httpOnly: false) but still has 90-day lifetime
 */
export const TOKEN_EXPIRES_COOKIE_CONFIG = {
  ...AUTH_COOKIE_CONFIG,
  httpOnly: false, // Needs to be readable by JS for useAuth hook
};

/**
 * Interface for OAuth token response from MusicBrainz
 */
interface TokenResponse {
  access_token: string;
  refresh_token?: string; // Optional - only included on initial exchange and token rotation
  expires_in: number;
}

/**
 * Set all authentication cookies after successful OAuth exchange or refresh
 * @param response - NextResponse object to set cookies on
 * @param tokens - Token response from MusicBrainz OAuth
 */
export function setAuthCookies(response: NextResponse, tokens: TokenResponse): void {
  // Refresh token - 90-day lifetime (only set if provided - token rotation scenario)
  if (tokens.refresh_token) {
    response.cookies.set('mb_refresh_token', tokens.refresh_token, AUTH_COOKIE_CONFIG);
  }

  // Access token - Short-lived, but cookie has 90-day lifetime (token itself expires via expires_in)
  response.cookies.set('mb_access_token', tokens.access_token, {
    ...AUTH_COOKIE_CONFIG,
    maxAge: tokens.expires_in, // Use actual token expiry
  });

  // Token expiry timestamp - Must have 90-day lifetime for auto-refresh on page reload
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  response.cookies.set('mb_token_expires_at', expiresAt.toString(), TOKEN_EXPIRES_COOKIE_CONFIG);
}

/**
 * Clear all authentication cookies (for logout)
 * @param response - NextResponse object to clear cookies from
 */
export function clearAuthCookies(response: NextResponse): void {
  const cookieNames = ['mb_access_token', 'mb_token_expires_at', 'mb_refresh_token'];

  cookieNames.forEach(name => {
    response.cookies.delete(name);
  });
}
