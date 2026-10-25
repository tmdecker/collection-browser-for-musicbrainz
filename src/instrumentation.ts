/**
 * @ai-file instrumentation
 * @ai-description Next.js server startup hook
 * @ai-features
 * - Gives outgoing connections more time per IP address (Node's 250 ms default made slow
 *   MusicBrainz/Cover Art Archive connects fail with ETIMEDOUT on networks without IPv6)
 * - Opens the SQLite cache database before the first request is handled, and imports the JSON
 *   cache files of older versions once
 */

// Per-address connect timeout for Node's "happy eyeballs" (IPv4/IPv6) connection attempts
const CONNECT_ATTEMPT_TIMEOUT_MS = 2500;

export async function register() {
  // Caches use the filesystem and net settings are Node-only, so only run in the Node.js runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const net = await import('node:net');
    net.setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_TIMEOUT_MS);

    const { cacheManager } = await import('@/lib/cache/cache-manager');
    await cacheManager.initialize();
  }
}
