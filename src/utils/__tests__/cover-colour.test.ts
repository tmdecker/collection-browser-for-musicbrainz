import { describe, expect, it } from 'vitest';
import { colourFromPixels, rgbToHueSat, tileColours } from '../cover-colour';

const pixels = (...rgb: [number, number, number][]) => rgb.flatMap(([r, g, b]) => [r, g, b, 255]);

describe('cover colour', () => {
  it('reads hue and saturation of plain colours', () => {
    expect(rgbToHueSat(255, 0, 0)).toEqual({ h: 0, s: 100 });
    expect(rgbToHueSat(0, 0, 255)).toEqual({ h: 240, s: 100 });
    expect(rgbToHueSat(128, 128, 128)).toEqual({ h: 0, s: 0 });
  });

  it('lets a colourful detail win over a grey background', () => {
    const colour = colourFromPixels(pixels([120, 120, 120], [120, 120, 120], [120, 120, 120], [20, 60, 220]));
    expect(colour!.h).toBeGreaterThan(200);
    expect(colour!.h).toBeLessThan(240);
  });

  it('skips transparent pixels and gives null for an empty image', () => {
    expect(colourFromPixels([255, 0, 0, 0])).toBeNull();
  });

  it('gives grey covers a neutral tile', () => {
    expect(tileColours({ h: 30, s: 5 }).background()).toBe('hsl(0 0% 17% / 1)');
    expect(tileColours(null).title).toBe('hsl(0 0% 80%)');
    expect(tileColours({ h: 200, s: 90 }).background(0.5)).toBe('hsl(200 45% 17% / 0.5)');
  });
});
