// Tests use an in-memory cache database, never the .cache/cache.db file in the working directory
import { vi } from 'vitest';
import { openCacheDatabase, setCacheDatabase } from '@/lib/cache/database';

setCacheDatabase(openCacheDatabase(':memory:'));

// The cache manager's start-up import would read the real .cache/*.json files into the in-memory
// database and rename them to *.imported, so the next dev server start finds nothing to import
vi.mock('@/lib/cache/cache-manager', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/cache/cache-manager')>();
  actual.cacheManager.initialize = () => Promise.resolve();
  return actual;
});
