/**
 * @ai-file instrumentation
 * @ai-description Next.js server startup hook
 * @ai-features
 * - Restores the server caches from disk before the first request is handled, so no route
 *   writes into an empty cache that a later restore would overwrite with older data
 */

export async function register() {
  // Caches use the filesystem, so only load them in the Node.js runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { cacheManager } = await import('@/lib/cache/cache-manager');
    await cacheManager.initialize();
  }
}
