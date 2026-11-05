import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

const refresh = () =>
  POST(
    new NextRequest('http://localhost/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: 'mb_refresh_token=test-refresh' },
    })
  );

// Cookies the response deletes (set with an empty value and an expiry in the past)
const clearedCookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .filter(cookie => /expires=Thu, 01 Jan 1970/i.test(cookie))
    .map(cookie => cookie.split('=')[0]);

describe('POST /api/auth/refresh', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('MUSICBRAINZ_OAUTH_CLIENT_ID', 'test-client');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs out when MusicBrainz rejects the refresh token', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    const response = await refresh();
    expect(response.status).toBe(401);
    expect(clearedCookies(response)).toContain('mb_refresh_token');
  });

  it.each([
    ['a server error', () => Promise.resolve(new Response('Bad gateway', { status: 502 }))],
    ['a rate limit', () => Promise.resolve(new Response('', { status: 429 }))],
    ['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
  ])('keeps the cookies on %s', async (_, answer) => {
    fetchMock.mockImplementation(answer);
    const response = await refresh();
    expect(response.status).toBe(503);
    expect(clearedCookies(response)).toEqual([]);
  });
});
