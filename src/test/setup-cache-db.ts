// Tests use an in-memory cache database, never the .cache/cache.db file in the working directory
import { openCacheDatabase, setCacheDatabase } from '@/lib/cache/database';

setCacheDatabase(openCacheDatabase(':memory:'));
