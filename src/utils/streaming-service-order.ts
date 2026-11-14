/**
 * @ai-file utility
 * @ai-description Order of the streaming services (and Plex) chosen in Settings
 * @ai-features
 * - normalizeServiceOrder: every known service exactly once, unknown entries dropped, new services appended
 * - orderedServiceLinks: an album's links in the user's order, only for services that are switched on
 * - moveService: move one service to another position (drag and drop, arrow buttons)
 */

import { StreamingLinks } from '@/types/music';
import {
  DEFAULT_STREAMING_ORDER,
  StreamingServiceKey,
  StreamingServicePreferences,
} from '@/types/preferences';

const KNOWN = new Set<string>(DEFAULT_STREAMING_ORDER);

/**
 * Cleans a stored order: keeps known services once each and appends any service the list is missing
 * (older saved preferences have no order, or lack services added later)
 */
export const normalizeServiceOrder = (order: unknown): StreamingServiceKey[] => {
  const result: StreamingServiceKey[] = [];
  if (Array.isArray(order)) {
    for (const key of order) {
      if (typeof key === 'string' && KNOWN.has(key) && !result.includes(key as StreamingServiceKey)) {
        result.push(key as StreamingServiceKey);
      }
    }
  }
  for (const key of DEFAULT_STREAMING_ORDER) {
    if (!result.includes(key)) result.push(key);
  }
  return result;
};

export interface ServiceLink {
  service: StreamingServiceKey;
  url: string;
}

/**
 * An album's links in the user's order; services switched off in Settings are left out
 */
export const orderedServiceLinks = (
  order: StreamingServiceKey[],
  enabled: Partial<StreamingServicePreferences>,
  links: StreamingLinks | null | undefined,
  plexUrl?: string
): ServiceLink[] =>
  normalizeServiceOrder(order).flatMap(service => {
    if (enabled[service] === false) return [];
    const url = service === 'plex' ? plexUrl : links?.[service];
    return url ? [{ service, url }] : [];
  });

/**
 * The order with one service moved from one position to another
 */
export const moveService = (
  order: StreamingServiceKey[],
  from: number,
  to: number
): StreamingServiceKey[] => {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order;
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};
