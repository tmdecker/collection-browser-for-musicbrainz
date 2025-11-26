/**
 * @ai-file api
 * @ai-description OAuth2 logout endpoint
 * @ai-features Token revocation, cookie clearing
 */

import { NextRequest, NextResponse } from 'next/server';
import { revokeToken } from '@/utils/oauth';
import { clearAuthCookies } from '@/utils/auth-cookies';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('mb_refresh_token')?.value;
    const clientId = process.env.MUSICBRAINZ_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MUSICBRAINZ_OAUTH_CLIENT_SECRET;

    // Optionally revoke the refresh token with MusicBrainz
    if (refreshToken && clientId) {
      try {
        await revokeToken({
          token: refreshToken,
          clientId,
          clientSecret, // Optional - for Confidential clients (Web applications)
        });
        console.log('✅ Token revoked with MusicBrainz');
      } catch (error) {
        // Log but don't fail - we'll clear cookies anyway
        console.warn('⚠️ Failed to revoke token with MusicBrainz:', error);
      }
    }

    // Clear all auth cookies
    const response = NextResponse.json({ success: true });
    clearAuthCookies(response);

    console.log('✅ User logged out successfully');
    return response;
  } catch (error) {
    console.error('❌ Error during logout:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
