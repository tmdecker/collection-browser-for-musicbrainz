/**
 * @ai-file utility
 * @ai-description Stepping to the previous or next album while the album details are open
 * @ai-features
 * - The neighbour in the grid as shown (sort, filters, search); no wrap-around at either end
 * - Reads a touch swipe: mostly sideways and long enough; swipes that start at the screen edge belong
 *   to the phone's own back gesture
 */

/** The album `step` places away from `currentId` in `albums` (1 = next, -1 = previous), or null at either end */
export const neighbourAlbum = <T extends { id: string }>(albums: T[], currentId: string, step: 1 | -1): T | null => {
  const index = albums.findIndex(album => album.id === currentId);
  if (index === -1) return null;
  return albums[index + step] ?? null;
};

export interface Point {
  x: number;
  y: number;
}

/** Swipes starting this close to a screen edge are left to the system back gesture */
export const SWIPE_EDGE_PX = 24;
/** Shortest sideways movement that counts as a swipe */
export const SWIPE_MIN_PX = 60;

/** 1 for a swipe to the left (next album), -1 for one to the right (previous), null for anything else */
export const swipeStep = (start: Point, end: Point, viewportWidth: number): 1 | -1 | null => {
  if (start.x < SWIPE_EDGE_PX || start.x > viewportWidth - SWIPE_EDGE_PX) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 1 : -1;
};
