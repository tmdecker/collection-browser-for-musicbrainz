import { describe, expect, it } from 'vitest';
import { neighbourAlbum, swipeStep } from '../album-steps';

const albums = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('neighbourAlbum', () => {
  it('steps through the grid order and stops at both ends', () => {
    expect(neighbourAlbum(albums, 'b', 1)?.id).toBe('c');
    expect(neighbourAlbum(albums, 'b', -1)?.id).toBe('a');
    expect(neighbourAlbum(albums, 'c', 1)).toBeNull();
    expect(neighbourAlbum(albums, 'a', -1)).toBeNull();
  });

  it('has no neighbour for an album that is filtered out of the grid', () => {
    expect(neighbourAlbum(albums, 'x', 1)).toBeNull();
  });
});

describe('swipeStep', () => {
  it('reads left as next and right as previous', () => {
    expect(swipeStep({ x: 300, y: 400 }, { x: 200, y: 410 }, 390)).toBe(1);
    expect(swipeStep({ x: 100, y: 400 }, { x: 200, y: 390 }, 390)).toBe(-1);
  });

  it('ignores short, mostly vertical and edge swipes', () => {
    expect(swipeStep({ x: 200, y: 400 }, { x: 160, y: 400 }, 390)).toBeNull();
    expect(swipeStep({ x: 200, y: 400 }, { x: 100, y: 250 }, 390)).toBeNull();
    expect(swipeStep({ x: 10, y: 400 }, { x: 200, y: 400 }, 390)).toBeNull();
    expect(swipeStep({ x: 385, y: 400 }, { x: 200, y: 400 }, 390)).toBeNull();
  });
});
