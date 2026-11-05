/**
 * @ai-file utility
 * @ai-description The main colour of a loaded cover image, for tinting a collection tile
 * @ai-features
 * - Draws the image tiny on a canvas and averages its pixels, weighting colourful pixels more
 *   than grey ones, so a bright detail on a dull cover still sets the hue
 * - Grey or nearly black covers give a neutral (unsaturated) colour
 * - Remembered per cover for the session, so a tile that mounts again is tinted right away
 */

export interface CoverColour {
  h: number;  // 0-360
  s: number;  // 0-100
}

const SIZE = 16;
const colours = new Map<string, CoverColour | null>();

/** The colour already worked out for this cover, if any (undefined: not yet) */
export function rememberedCoverColour(key: string): CoverColour | null | undefined {
  return colours.get(key);
}

/** Pure part, so it can be tested without a canvas: RGBA bytes in, hue and saturation out */
export function colourFromPixels(data: ArrayLike<number>): CoverColour | null {
  let r = 0, g = 0, b = 0, weight = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const pr = data[i], pg = data[i + 1], pb = data[i + 2];
    const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
    // Saturation of the pixel, plus a little so all-grey covers still average to something
    const w = (max === 0 ? 0 : (max - min) / max) + 0.05;
    r += pr * w; g += pg * w; b += pb * w; weight += w;
  }
  if (weight === 0) return null;
  return rgbToHueSat(r / weight, g / weight, b / weight);
}

export function rgbToHueSat(r: number, g: number, b: number): CoverColour {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: Math.round(((h * 60) + 360) % 360), s: Math.round(Math.min(1, s) * 100) };
}

/** Main colour of an image that has finished loading; null when it can't be read */
export function coverColourOf(img: HTMLImageElement, key: string = img.currentSrc || img.src): CoverColour | null {
  const known = colours.get(key);
  if (known !== undefined) return known;
  let colour: CoverColour | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      colour = colourFromPixels(ctx.getImageData(0, 0, SIZE, SIZE).data);
    }
  } catch {
    // Image from another origin without CORS: no colour, the tile stays neutral
  }
  colours.set(key, colour);
  return colour;
}

/** Tile colours for a cover colour: dark background, light title; grey covers give a neutral grey */
export function tileColours(colour: CoverColour | null) {
  const grey = !colour || colour.s < 12;
  const h = grey ? 0 : colour!.h;
  const s = grey ? 0 : Math.min(colour!.s, 45);
  return {
    background: (alpha = 1) => `hsl(${h} ${s}% 17% / ${alpha})`,
    title: grey ? 'hsl(0 0% 80%)' : `hsl(${h} 75% 76%)`,
  };
}
