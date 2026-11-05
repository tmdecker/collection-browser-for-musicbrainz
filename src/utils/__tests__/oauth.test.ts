import { describe, expect, it } from 'vitest';
import { OAuthError, buildAuthorizationUrl, isTokenRejected } from '@/utils/oauth';

describe('buildAuthorizationUrl', () => {
  it('asks for offline access so MusicBrainz issues a refresh token', () => {
    const url = new URL(
      buildAuthorizationUrl({
        clientId: 'id',
        redirectUri: 'http://localhost:3000/api/auth/callback',
        codeChallenge: 'challenge',
        state: 'state',
        scope: ['profile', 'collection'],
      })
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
  });
});

describe('isTokenRejected', () => {
  it('is true when MusicBrainz rejects the refresh token', () => {
    expect(isTokenRejected(new OAuthError('', 400, 'invalid_grant'))).toBe(true);
    expect(isTokenRejected(new OAuthError('', 401, null))).toBe(true);
  });

  it('is false for temporary failures', () => {
    expect(isTokenRejected(new TypeError('fetch failed'))).toBe(false);
    expect(isTokenRejected(new OAuthError('', 503, null))).toBe(false);
    expect(isTokenRejected(new OAuthError('', 429, null))).toBe(false);
  });
});
