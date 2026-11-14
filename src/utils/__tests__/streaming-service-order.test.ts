import { describe, expect, it } from 'vitest';
import { DEFAULT_STREAMING_ORDER } from '@/types/preferences';
import { moveService, normalizeServiceOrder, orderedServiceLinks } from '../streaming-service-order';

describe('normalizeServiceOrder', () => {
  it('returns the default order for missing or broken values', () => {
    expect(normalizeServiceOrder(undefined)).toEqual(DEFAULT_STREAMING_ORDER);
    expect(normalizeServiceOrder('spotify')).toEqual(DEFAULT_STREAMING_ORDER);
  });

  it('keeps the saved order, drops unknown and duplicate entries, appends missing services', () => {
    const order = normalizeServiceOrder(['deezer', 'nope', 'spotify', 'deezer', 42]);
    expect(order.slice(0, 2)).toEqual(['deezer', 'spotify']);
    expect(order).toHaveLength(DEFAULT_STREAMING_ORDER.length);
    expect(new Set(order).size).toBe(order.length);
  });
});

describe('orderedServiceLinks', () => {
  const links = { spotify: 'https://open.spotify.com/album/1', deezer: 'https://www.deezer.com/album/2' };

  it('follows the user order and includes Plex', () => {
    const result = orderedServiceLinks(['deezer', 'plex', 'spotify'], {}, links, 'https://app.plex.tv/x');
    expect(result.map(l => l.service)).toEqual(['deezer', 'plex', 'spotify']);
  });

  it('leaves out switched-off services and services without a link', () => {
    const result = orderedServiceLinks(['plex', 'spotify', 'tidal', 'deezer'], { spotify: false }, links);
    expect(result).toEqual([{ service: 'deezer', url: links.deezer }]);
  });

  it('handles an album without links', () => {
    expect(orderedServiceLinks(DEFAULT_STREAMING_ORDER, {}, null)).toEqual([]);
  });
});

describe('moveService', () => {
  it('moves a service up or down', () => {
    expect(moveService(['plex', 'spotify', 'tidal'], 2, 0)).toEqual(['tidal', 'plex', 'spotify']);
    expect(moveService(['plex', 'spotify', 'tidal'], 0, 1)).toEqual(['spotify', 'plex', 'tidal']);
  });

  it('ignores moves out of range', () => {
    const order = ['plex', 'spotify'] as const;
    expect(moveService([...order], 0, 5)).toEqual(order);
  });
});
