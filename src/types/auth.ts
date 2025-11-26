/**
 * @ai-file types
 * @ai-description Authentication type definitions for MusicBrainz OAuth2 with PKCE
 * @ai-dependencies None
 * @ai-features
 * - OAuth2 token interfaces (OAuthTokenResponse, StoredTokenData)
 * - MusicBrainz user profile and collection list types
 * - Auth state management
 */

// OAuth2 Token Response
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// Stored token data with expiry
export interface StoredTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Timestamp when token expires
  scope: string;
}

// MusicBrainz User Profile
export interface MusicBrainzUser {
  id: string;
  name: string;
  email?: string;
}

// MusicBrainz Collection (simplified)
export interface MusicBrainzCollection {
  id: string;
  name: string;
  editor: string;
  'entity-type': string;
  type: string;
  'type-id': string;
  'release-group-count'?: number;
  'release-count'?: number;
}

// Collection list response
export interface MusicBrainzCollectionList {
  collections: MusicBrainzCollection[];
  'collection-count': number;
  'collection-offset': number;
}

// PKCE code verifier and challenge
export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

// OAuth state parameter (for CSRF protection)
export interface OAuthState {
  state: string;
  redirectTo?: string;
}

// Auth status
export type AuthStatus = 'unauthenticated' | 'authenticating' | 'authenticated' | 'error';

// Auth error types
export interface AuthError {
  type: 'auth_failed' | 'token_expired' | 'refresh_failed' | 'network_error' | 'invalid_state';
  message: string;
  details?: string;
}

// Complete auth state
export interface AuthState {
  status: AuthStatus;
  user: MusicBrainzUser | null;
  accessToken: string | null;
  expiresAt: number | null;
  error: AuthError | null;
}
