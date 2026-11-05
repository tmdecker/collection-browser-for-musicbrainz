/**
 * @ai-file api
 * @ai-description Fetch authenticated user's MusicBrainz profile
 * @ai-features OAuth userinfo endpoint (POST), Bearer token authentication, 502 for non-JSON answers
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
    // POST, not GET: MusicBrainz answers GET with an HTML "Verifying your browser" page (200)
    const response = await fetch(`${MB_OAUTH_URL}/userinfo`, {
      method: 'POST',
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

    // A bot check or error page instead of JSON: temporary, the client retries
    if (!response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.text();
      console.error(`❌ User profile answer is not JSON (${response.status}): ${body.slice(0, 200)}`);
      return NextResponse.json(
        { error: 'Unexpected answer from MusicBrainz' },
        { status: 502 }
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
