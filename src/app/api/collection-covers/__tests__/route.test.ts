import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { getCacheDatabase } from '@/lib/cache/database';
import { GET } from '../route';
import { DELETE, PUT } from '../[id]/route';

const COLLECTION = 'f4f5c9a0-1b2c-4d3e-8f9a-0b1c2d3e4f5a';
const RG = 'b1392450-e666-3926-a536-22c65f834433';
const OTHER_RG = '0e0c1a5b-2b6a-3b8a-9f3e-6c1f6a2d6b11';

const request = (method: string, body?: unknown, signedIn = true) =>
  new NextRequest(`http://localhost/api/collection-covers/${COLLECTION}`, {
    method,
    headers: signedIn ? { cookie: 'mb_access_token=token' } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = (id = COLLECTION) => ({ params: Promise.resolve({ id }) });
const covers = async () => (await (await GET()).json()).covers;

describe('/api/collection-covers', () => {
  beforeEach(() => {
    getCacheDatabase().exec('DELETE FROM collection_covers');
  });

  it('saves, replaces and resets a chosen cover', async () => {
    expect(await covers()).toEqual({});
    expect((await PUT(request('PUT', { releaseGroupId: RG }), params())).status).toBe(200);
    expect(await covers()).toEqual({ [COLLECTION]: RG });
    await PUT(request('PUT', { releaseGroupId: OTHER_RG }), params());
    expect(await covers()).toEqual({ [COLLECTION]: OTHER_RG });
    expect((await DELETE(request('DELETE'), params())).status).toBe(200);
    expect(await covers()).toEqual({});
  });

  it('needs a signed-in browser to change a cover', async () => {
    expect((await PUT(request('PUT', { releaseGroupId: RG }, false), params())).status).toBe(401);
    expect((await DELETE(request('DELETE', undefined, false), params())).status).toBe(401);
    expect(await covers()).toEqual({});
  });

  it('rejects anything that is not an MBID', async () => {
    expect((await PUT(request('PUT', { releaseGroupId: 'x' }), params())).status).toBe(400);
    expect((await PUT(request('PUT', { releaseGroupId: RG }), params('../etc'))).status).toBe(400);
    expect((await PUT(request('PUT', 'not json'), params())).status).toBe(400);
  });
});
