/**
 * @ai-file lib
 * @ai-description Disk cache of resized cover images (.image-cache), shared by the image route and album refresh
 * @ai-dependencies node:crypto, node:fs, node:path
 * @ai-features
 * - One WebP file per image URL and size (MD5 file names)
 * - One marker per image URL for covers Cover Art Archive answered 404 for
 * - forgetCachedImage drops every size and the marker, so the next request downloads the image again
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// Security: Only a few output sizes and one quality, so the disk cache cannot be filled with
// millions of variants of the same image (2000 × 2000 × 100 combinations were possible before)
export const ALLOWED_SIZES = [180, 250, 360, 500, 720, 1080];
export const QUALITY = 80;

// Create cache directory if it doesn't exist
const cacheDir = path.join(process.cwd(), '.image-cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

export const cachePathFor = (imageUrl: string, width: number, height: number): string => {
  const hash = createHash('md5').update(`${imageUrl}_${width}x${height}_q${QUALITY}`).digest('hex');
  return path.join(cacheDir, `${hash}.webp`);
};

// One marker per image URL, whatever size was asked for
export const missingMarkerFor = (imageUrl: string): string =>
  path.join(cacheDir, `${createHash('md5').update(imageUrl).digest('hex')}.missing`);

/**
 * Remove every cached size of an image and its "not found" marker
 */
export const forgetCachedImage = (imageUrl: string): void => {
  for (const width of ALLOWED_SIZES) {
    for (const height of ALLOWED_SIZES) {
      fs.rmSync(cachePathFor(imageUrl, width, height), { force: true });
    }
  }
  fs.rmSync(missingMarkerFor(imageUrl), { force: true });
};
