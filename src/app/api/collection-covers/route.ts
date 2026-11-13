/**
 * @ai-file api
 * @ai-description Every cover chosen for a collection or series (GET)
 * @ai-dependencies collection-covers
 * @ai-features One small map for the whole Collections page: { covers: { [collectionId]: releaseGroupId } }
 */

import { NextResponse } from 'next/server';
import { getCollectionCovers } from '@/lib/collection-covers';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ covers: getCollectionCovers() }, { headers: { 'Cache-Control': 'no-store' } });
}
