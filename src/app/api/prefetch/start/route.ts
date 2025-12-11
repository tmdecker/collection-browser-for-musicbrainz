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

// Force dynamic runtime
export const dynamic = 'force-dynamic';

/**
 * POST handler for /api/prefetch/start
 * Request body: { rgMbids: string[] }
 * Response: { queued: number, alreadyCached: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rgMbids } = body;

    // Validate input
    if (!Array.isArray(rgMbids)) {
      return NextResponse.json(
        { error: 'rgMbids must be an array' },
        { status: 400 }
      );
    }

    if (rgMbids.length === 0) {
      return NextResponse.json({ queued: 0, alreadyCached: 0 });
    }

    // Start prefetch (non-blocking)
    const result = await startPrefetchForCollection(rgMbids);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error in prefetch start endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
