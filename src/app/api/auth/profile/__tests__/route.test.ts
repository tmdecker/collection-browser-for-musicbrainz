import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

const getProfile = () =>
  GET(new NextRequest('http://localhost/api/auth/profile', { headers: { cookie: 'mb_access_token=test-access' } }));

describe('GET /api/auth/profile', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks userinfo with POST and returns the user', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ sub: 'tim', metabrainz_user_id: 1 }), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })
    );
    const response = await getProfile();
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(await response.json()).toEqual({ id: 1, name: 'tim' });
  });

  it('answers 502 for an HTML page instead of JSON (bot check)', async () => {
    fetchMock.mockResolvedValue(
      new Response('<!DOCTYPE html><title>Verifying your browser</title>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    );
    const response = await getProfile();
    expect(response.status).toBe(502);
  });
});
