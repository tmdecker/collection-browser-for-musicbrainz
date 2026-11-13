/**
 * @ai-file api
 * @ai-description Choose (PUT) or reset (DELETE) the cover of one collection or series
 * @ai-dependencies collection-covers, mbid-validation
 * @ai-features
 * - PUT body { releaseGroupId }; DELETE goes back to the automatic cover
 * - Signed-in users only (MusicBrainz session cookie present); everyone can read the covers
 */

import { NextRequest, NextResponse } from 'next/server';
import { clearCollectionCover, setCollectionCover } from '@/lib/collection-covers';
import { isMbid } from '@/utils/mbid-validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

// A signed-in browser has the access token or, once that expired, the refresh token
const signedIn = (request: NextRequest) =>
  !!(request.cookies.get('mb_access_token')?.value || request.cookies.get('mb_refresh_token')?.value);

async function checked(request: NextRequest, context: Context): Promise<string | NextResponse> {
  if (!signedIn(request)) return NextResponse.json({ error: 'Sign in to change covers' }, { status: 401 });
  const { id } = await context.params;
  if (!isMbid(id)) return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 });
  return id;
}

export async function PUT(request: NextRequest, context: Context) {
  const id = await checked(request, context);
  if (typeof id !== 'string') return id;
  const body = await request.json().catch(() => null) as { releaseGroupId?: unknown } | null;
  const releaseGroupId = body?.releaseGroupId;
  if (!isMbid(releaseGroupId)) return NextResponse.json({ error: 'Invalid release group ID' }, { status: 400 });
  setCollectionCover(id, releaseGroupId);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, context: Context) {
  const id = await checked(request, context);
  if (typeof id !== 'string') return id;
  clearCollectionCover(id);
  return NextResponse.json({ success: true });
}
