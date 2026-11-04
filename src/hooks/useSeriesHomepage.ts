/**
 * @ai-file hook
 * @ai-description Official homepage of the open series (null while unknown, for collections, or when it has none)
 * @ai-dependencies React, series-homepage utils
 */

'use client';

import { useEffect, useState } from 'react';
import { fetchSeriesHomepage, readCachedHomepage, writeCachedHomepage } from '@/utils/series-homepage';

export function useSeriesHomepage(seriesId: string | null | undefined): string | null {
  const [homepage, setHomepage] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!seriesId) return;
    const controller = new AbortController();
    const cached = readCachedHomepage(seriesId);
    const lookup = cached !== undefined
      ? Promise.resolve(cached)
      : fetchSeriesHomepage(seriesId, controller.signal).then(url => {
          writeCachedHomepage(seriesId, url);
          return url;
        });
    lookup
      .then(url => {
        if (!controller.signal.aborted) setHomepage({ id: seriesId, url });
      })
      .catch(() => {
        // No link this time (offline, rate limited); looked up again when the series is opened next
      });
    return () => controller.abort();
  }, [seriesId]);

  // Only the homepage of the series that is open now
  return seriesId && homepage?.id === seriesId ? homepage.url : null;
}
