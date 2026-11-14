/**
 * @ai-file hook
 * @ai-description Addresses to open for an album's ordered service links (desktop app settings applied)
 * @ai-dependencies streaming-open-url, usePreferences
 * @ai-features Resolves Apple Music geo links in the background and swaps in the app link once known
 */

import { useEffect, useState } from 'react';
import { usePreferences } from '@/hooks/usePreferences';
import { ServiceLink } from '@/utils/streaming-service-order';
import { needsAppleMusicResolution, openUrlFor, resolveAppleMusicUrl } from '@/utils/streaming-open-url';

export interface OpenableServiceLink extends ServiceLink {
  /** What the link opens: the web link or the desktop app's own link */
  href: string;
}

export function useServiceOpenUrls(links: ServiceLink[]): OpenableServiceLink[] {
  const { streaming } = usePreferences().preferences;
  const [resolved, setResolved] = useState<Record<string, string>>({});

  // Only Apple Music geo links need a lookup (at most one per album)
  const geoUrl = links.find(link => needsAppleMusicResolution(link.service, link.url, streaming))?.url;
  useEffect(() => {
    if (!geoUrl || resolved[geoUrl]) return;
    let cancelled = false;
    void resolveAppleMusicUrl(geoUrl).then(url => {
      if (!cancelled) setResolved(previous => ({ ...previous, [geoUrl]: url }));
    });
    return () => {
      cancelled = true;
    };
  }, [geoUrl, resolved]);

  return links.map(link => ({
    ...link,
    href: resolved[link.url] ?? openUrlFor(link.service, link.url, streaming),
  }));
}
