/**
 * @ai-file api
 * @ai-description Fetch authenticated user's MusicBrainz profile
 * @ai-features OAuth userinfo endpoint, Bearer token authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserAgent } from '@/utils/config/userAgent';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

const MB_OAUTH_URL = 'https://musicbrainz.org/oauth2';

export async function GET(request: NextRequest) {
  try {
    // Get access token from cookie
    const accessToken = request.cookies.get('mb_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch user profile using OAuth2 userinfo endpoint
    const response = await fetch(`${MB_OAUTH_URL}/userinfo`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': getUserAgent(),
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch user profile: ${response.status}`, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // MusicBrainz OAuth2 userinfo response format:
    // - sub: username/editor name
    // - metabrainz_user_id: numeric user ID
    // - email: email address (if email scope granted)
    // - profile: profile URL
    return NextResponse.json({
      id: data.metabrainz_user_id,
      name: data.sub,
      email: data.email,
    });

  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
