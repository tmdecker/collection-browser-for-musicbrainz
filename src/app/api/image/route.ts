/**
 * @ai-file api
 * @ai-description Custom image optimization API that resizes, converts, and caches images
 * @ai-dependencies Next.js, sharp, node:crypto, node:fs, node:path
 * @ai-features
 * - Resizes images to one of a fixed set of sizes (w, h params, default 180x180)
 * - Converts images to WebP at a fixed quality (80)
 * - Only fetches allowed hosts, checks every redirect hop, caps the download size
 * - Requests Cover Art Archive thumbnails (250/500/1200) instead of full-size originals
 * - Disk-based caching with MD5 hash filenames
 * - Immutable cache headers for long-term caching
 * - Handles relative and absolute URLs with error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

// Security: Allowlist of permitted image sources (prevents SSRF attacks)
const ALLOWED_IMAGE_HOSTS = [
  'coverartarchive.org',
  'archive.org',
  'ia600900.us.archive.org',
  'ia800900.us.archive.org',
  'ia900900.us.archive.org',
];

// Security: Only a few output sizes and one quality, so the disk cache cannot be filled with
// millions of variants of the same image (2000 × 2000 × 100 combinations were possible before)
const ALLOWED_SIZES = [180, 250, 360, 500, 720, 1080];
const DEFAULT_SIZE = 180;
const QUALITY = 80;

// Security: Limits on what is downloaded and decoded
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 30000;

/**
 * Round a requested size up to the next allowed size (or the largest one)
 */
const snapSize = (raw: string | null): number => {
  const requested = parseInt(raw || '', 10);
  if (isNaN(requested)) return DEFAULT_SIZE;
  return ALLOWED_SIZES.find(size => size >= requested) ?? ALLOWED_SIZES[ALLOWED_SIZES.length - 1];
};

const isAllowedImageUrl = (url: URL): boolean =>
  (url.protocol === 'https:' || url.protocol === 'http:') &&
  !url.username &&
  !url.password &&
  !url.port &&
  ALLOWED_IMAGE_HOSTS.some(allowedHost => url.hostname === allowedHost || url.hostname.endsWith(`.${allowedHost}`));

/**
 * Ask Cover Art Archive for its ready-made thumbnail instead of the original scan
 * (originals can be 25 MB+ PNGs; front-500 of the same cover is about 60 KB)
 */
const toCoverArtThumbnail = (url: URL, size: number): URL => {
  if (url.hostname !== 'coverartarchive.org' || !/\/(front|back)$/.test(url.pathname)) {
    return url;
  }
  const thumbnail = new URL(url);
  thumbnail.pathname += `-${size <= 250 ? 250 : size <= 500 ? 500 : 1200}`;
  return thumbnail;
};

/**
 * Fetch an image, following redirects manually so every hop is checked against the allowlist
 * (Cover Art Archive redirects to archive.org; anything else is refused)
 */
const fetchAllowedImage = async (startUrl: URL): Promise<Response> => {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current.toString(), {
      cache: 'no-store', // Disable Next.js fetch cache (we use disk cache instead)
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }

    const next = new URL(location, current);
    if (!isAllowedImageUrl(next)) {
      throw new Error(`Redirect to non-permitted image host blocked: ${next.hostname}`);
    }
    current = next;
  }

  throw new Error('Too many redirects');
};

/**
 * Read the body, refusing anything larger than MAX_IMAGE_BYTES before sharp decodes it
 */
const readLimitedBody = async (response: Response): Promise<Buffer | null> => {
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_IMAGE_BYTES || !response.body) {
    await response.body?.cancel();
    return null;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
};

// Create cache directory if it doesn't exist
const cacheDir = path.join(process.cwd(), '.image-cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    // Validate URL parameter
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing image URL' },
        { status: 400 }
      );
    }

    // Security: Snap to allowed sizes and a fixed quality (the q parameter is ignored)
    const width = snapSize(searchParams.get('w'));
    const height = snapSize(searchParams.get('h'));
    const quality = QUALITY;

    // Create a hash of the URL and parameters for caching
    const hash = createHash('md5')
      .update(`${imageUrl}_${width}x${height}_q${quality}`)
      .digest('hex');
    
    const cachePath = path.join(cacheDir, `${hash}.webp`);
    
    // Check if we have this image cached
    if (fs.existsSync(cachePath)) {
      const cachedImage = fs.readFileSync(cachePath);
      return new NextResponse(cachedImage, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
    
    // Security: Validate URL against allowlist to prevent SSRF attacks
    let fullImageUrl: string;
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(imageUrl);

      if (!isAllowedImageUrl(parsedUrl)) {
        console.warn(`⚠️ Blocked unauthorized image source: ${parsedUrl.hostname}`);
        return NextResponse.json(
          { error: 'Image source not permitted' },
          { status: 403 }
        );
      }

      fullImageUrl = imageUrl;
    } catch (urlError) {
      // If URL parsing fails, it might be a relative URL - reject for security
      console.warn(`⚠️ Invalid or relative URL rejected: ${imageUrl}`);
      return NextResponse.json(
        { error: 'Invalid image URL format' },
        { status: 400 }
      );
    }
    
    // Fetch the original image
    let imageResponse;
    try {
      imageResponse = await fetchAllowedImage(toCoverArtThumbnail(parsedUrl, Math.max(width, height)));

      if (!imageResponse.ok) {
        // 404s are expected for albums without cover art - use info level
        if (imageResponse.status === 404) {
          console.log(`ℹ️ Cover art not found (expected): ${fullImageUrl}`);
        } else {
          // Other status codes warrant a warning
          console.warn(`⚠️ Image fetch failed: ${fullImageUrl} - Status: ${imageResponse.status}`);
        }
        return NextResponse.json(
          { error: `Failed to fetch image: ${imageResponse.status}` },
          { status: imageResponse.status }
        );
      }
    } catch (error) {
      // Check if this is a transient network issue (timeout/unreachable)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkIssue = errorMessage.includes('ETIMEDOUT') ||
                            errorMessage.includes('EHOSTUNREACH') ||
                            errorMessage.includes('ECONNREFUSED');

      if (isNetworkIssue) {
        // Network timeouts are transient external issues - use warning level
        console.warn(`⚠️ Network timeout fetching cover art (transient CoverArt Archive issue)`);
      } else {
        // Unexpected errors should be logged as errors
        console.error(`❌ Error fetching image ${fullImageUrl}:`, error);
      }

      return NextResponse.json(
        { error: `Failed to fetch image: ${errorMessage}` },
        { status: 500 }
      );
    }
    
    const imageBuffer = await readLimitedBody(imageResponse);
    if (!imageBuffer) {
      console.warn(`⚠️ Image larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB refused: ${fullImageUrl}`);
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    // Generate a WebP thumbnail with sharp
    const webpImage = await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover' })
      .webp({ quality })
      .toBuffer();
    
    // Save to cache
    fs.writeFileSync(cachePath, webpImage);
    
    // Return the WebP image
    return new NextResponse(webpImage, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('❌ Image optimization error:', error);
    return NextResponse.json(
      { error: 'Image processing failed' },
      { status: 500 }
    );
  }
}