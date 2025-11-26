/**
 * @ai-file utils
 * @ai-description OAuth2 utility functions for MusicBrainz authentication
 * @ai-features Authorization URLs, token exchange/refresh/revocation, expiry checks
 */

const MUSICBRAINZ_OAUTH_BASE = 'https://musicbrainz.org/oauth2';

/**
 * Shared OAuth request handler for token and revoke endpoints
 * @internal
 */
async function oauthRequest(
  endpoint: 'token' | 'revoke',
  body: Record<string, string>,
  params: { clientId: string; clientSecret?: string }
): Promise<any> {
  const requestBody: Record<string, string> = {
    ...body,
    client_id: params.clientId,
  };

  // Add client_secret for Confidential clients (Web applications)
  if (params.clientSecret) {
    requestBody.client_secret = params.clientSecret;
  }

  const response = await fetch(`${MUSICBRAINZ_OAUTH_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth ${endpoint} failed: ${error}`);
  }

  // Only parse JSON for token endpoint, revoke returns void
  return endpoint === 'token' ? response.json() : undefined;
}

/**
 * Build the MusicBrainz OAuth2 authorization URL
 */
export function buildAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope: string[];
}): string {
  const url = new URL(`${MUSICBRAINZ_OAUTH_BASE}/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', params.scope.join(' '));

  return url.toString();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}> {
  return oauthRequest(
    'token',
    {
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    },
    { clientId: params.clientId, clientSecret: params.clientSecret }
  );
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret?: string;
}): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}> {
  return oauthRequest(
    'token',
    {
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
    },
    { clientId: params.clientId, clientSecret: params.clientSecret }
  );
}

/**
 * Revoke a token (access or refresh)
 */
export async function revokeToken(params: {
  token: string;
  clientId: string;
  clientSecret?: string;
}): Promise<void> {
  await oauthRequest(
    'revoke',
    { token: params.token },
    { clientId: params.clientId, clientSecret: params.clientSecret }
  );
}

/**
 * Check if a token is expired or about to expire
 * @param expiresAt - Timestamp when token expires
 * @param bufferSeconds - Buffer time before expiry to consider token expired (default: 60s)
 */
export function isTokenExpired(expiresAt: number | null, bufferSeconds = 60): boolean {
  if (!expiresAt) return true;
  const now = Date.now();
  return now >= expiresAt - bufferSeconds * 1000;
}

/**
 * Calculate token expiry timestamp
 * @param expiresIn - Seconds until token expires
 * @returns Timestamp when token will expire
 */
export function calculateExpiryTimestamp(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}
