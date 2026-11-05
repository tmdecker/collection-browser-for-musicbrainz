import { describe, expect, it } from 'vitest';
import { OAuthError, buildAuthorizationUrl, isTokenRejected } from '@/utils/oauth';

const authUrl = (forceApproval?: boolean) =>
  new URL(
    buildAuthorizationUrl({
      clientId: 'id',
      redirectUri: 'http://localhost:3000/api/auth/callback',
      codeChallenge: 'challenge',
      state: 'state',
      scope: ['profile', 'collection'],
      forceApproval,
    })
  );

describe('buildAuthorizationUrl', () => {
  it('asks for offline access so MusicBrainz issues a refresh token', () => {
    expect(authUrl().searchParams.get('access_type')).toBe('offline');
  });

  it('forces the consent page only when asked', () => {
    expect(authUrl().searchParams.has('approval_prompt')).toBe(false);
    expect(authUrl(true).searchParams.get('approval_prompt')).toBe('force');
  });
});

describe('isTokenRejected', () => {
  it('is true when MusicBrainz rejects the refresh token', () => {
    expect(isTokenRejected(new OAuthError('', 400, 'invalid_grant'))).toBe(true);
    expect(isTokenRejected(new OAuthError('', 401, null))).toBe(true);
  });

  it('is false for temporary failures', () => {
    expect(isTokenRejected(new TypeError('fetch failed'))).toBe(false);
    expect(isTokenRejected(new OAuthError('', 0, null))).toBe(false);
    expect(isTokenRejected(new OAuthError('', 503, null))).toBe(false);
    expect(isTokenRejected(new OAuthError('', 429, null))).toBe(false);
  });
});
