/**
 * @ai-file api
 * @ai-description Cache statistics API endpoint
 * @ai-dependencies cache-manager, prefetch-service
 * @ai-features
 * - Exposes cache statistics for monitoring
 * - Returns prefetch progress and queue status
 * - Auto-updates every 10 seconds from client
 */

import { NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache/cache-manager';
import { getPrefetchStatus } from '@/lib/prefetch/prefetch-service';

// Force dynamic rendering (no static generation)
export const dynamic = 'force-dynamic';

/**
 * GET /api/cache/stats
 * Returns cache statistics, prefetch progress, and queue status
 */
export async function GET() {
  try {
    // Get aggregate cache stats
    const cacheStats = cacheManager.getAggregateStats();

    // Get prefetch status
    const prefetchStatus = getPrefetchStatus();

    // Calculate totals
    const total =
      prefetchStatus.completed +
      prefetchStatus.processing +
      prefetchStatus.highPriority +
      prefetchStatus.lowPriority;

    const percentage = total > 0
      ? Math.round((prefetchStatus.completed / total) * 100)
      : 0;

    // Derive status string
    const status = prefetchStatus.isRunning ? 'running' : 'idle';

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      releaseGroups: {
        cached: cacheStats.releaseGroups.entries,
        hits: cacheStats.releaseGroups.hits,
        misses: cacheStats.releaseGroups.misses,
        hitRate: cacheStats.releaseGroups.hitRate,
        memoryMB: cacheStats.releaseGroups.memoryMB,
      },
      releases: {
        cached: cacheStats.releases.entries,
        hits: cacheStats.releases.hits,
        misses: cacheStats.releases.misses,
        hitRate: cacheStats.releases.hitRate,
        memoryMB: cacheStats.releases.memoryMB,
      },
      overall: {
        totalMemoryMB: cacheStats.overall.totalMemoryMB,
        combinedHitRate: cacheStats.overall.combinedHitRate,
      },
      prefetch: {
        status,
        completed: prefetchStatus.completed,
        total,
        percentage,
      },
      queue: {
        highPriority: prefetchStatus.highPriority,
        lowPriority: prefetchStatus.lowPriority,
        processing: prefetchStatus.processing,
      },
    });
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve cache statistics' },
      { status: 500 }
    );
  }
}
