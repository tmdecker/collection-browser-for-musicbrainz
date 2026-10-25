/**
 * @ai-file api
 * @ai-description API endpoint to trigger background prefetch for release groups
 * @ai-dependencies prefetch-service
 * @ai-features
 * - POST endpoint to start prefetch for a collection
 * - Non-blocking (returns immediately)
 * - Returns count of queued and already-cached RGs
 */

import { NextRequest, NextResponse } from 'next/server';
import { startPrefetchForCollection } from '@/lib/prefetch/prefetch-service';
import { isMbid } from '@/utils/mbid-validation';

// Security: each item costs several rate-limited MusicBrainz calls, so cap the batch size
const MAX_PREFETCH_ITEMS = 5000;

// Force dynamic runtime
export const dynamic = 'force-dynamic';

/**
 * POST handler for /api/prefetch/start
 * Request body: { rgMbids: string[] }
 * Response: { queued: number, alreadyCached: number }
 */
export async function POST(request: NextRequest) {
  // PREFETCH_ENABLED=false turns off background prefetch, e.g. on a dev server that shares
  // its IP (and MusicBrainz's ~1 request/second limit) with production. Clicks still load on demand
  if (process.env.PREFETCH_ENABLED === 'false') {
    return NextResponse.json({ queued: 0, alreadyCached: 0, disabled: true });
  }

  try {
    const body = await request.json();
    const { rgMbids, country } = body;

    // Validate input
    if (!Array.isArray(rgMbids)) {
      return NextResponse.json(
        { error: 'rgMbids must be an array' },
        { status: 400 }
      );
    }

    if (rgMbids.length > MAX_PREFETCH_ITEMS) {
      return NextResponse.json(
        { error: `rgMbids may contain at most ${MAX_PREFETCH_ITEMS} items` },
        { status: 400 }
      );
    }

    if (!rgMbids.every(isMbid)) {
      return NextResponse.json(
        { error: 'rgMbids must contain only MusicBrainz IDs' },
        { status: 400 }
      );
    }

    if (country !== undefined && (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country))) {
      return NextResponse.json({ error: 'country must be a two-letter code' }, { status: 400 });
    }

    if (rgMbids.length === 0) {
      return NextResponse.json({ queued: 0, alreadyCached: 0 });
    }

    // Start prefetch (non-blocking)
    const result = await startPrefetchForCollection(rgMbids, country);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error in prefetch start endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
