/**
 * @ai-file api
 * @ai-description Custom image optimization API that resizes, converts, and caches images
 * @ai-dependencies Next.js, sharp, node:crypto, node:fs, node:path
 * @ai-features
 * - Resizes images to one of a fixed set of sizes (w, h params, default 180x180)
 * - Converts images to WebP at a fixed quality (80)
 * - Only fetches allowed hosts, checks every redirect hop, caps the download size
 * - Requests Cover Art Archive thumbnails (250/500/1200) instead of full-size originals
 * - Requests to coverartarchive.org are spaced 250 ms apart (MetaBrainz servers)
 * - Disk-based caching with MD5 hash filenames (lib/image-cache)
 * - Remembers covers that don't exist (7 days), so they are not requested again on every grid load
 * - One download per Cover Art Archive thumbnail: every size made from it is stored at once
 * - Concurrent requests for the same thumbnail share one download
 * - Immutable cache headers for long-term caching
 * - Handles relative and absolute URLs with error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import fs from 'fs';
import { createRateLimiter } from '@/lib/rate-limiter';
import { ALLOWED_SIZES, cachePathFor, missingMarkerFor, QUALITY } from '@/lib/image-cache';

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

const DEFAULT_SIZE = 180;

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
const isCoverArtImage = (url: URL): boolean =>
  url.hostname === 'coverartarchive.org' && /\/(front|back)$/.test(url.pathname);

const thumbnailSize = (size: number): number => (size <= 250 ? 250 : size <= 500 ? 500 : 1200);

const toCoverArtThumbnail = (url: URL, size: number): URL => {
  if (!isCoverArtImage(url)) {
    return url;
  }
  const thumbnail = new URL(url);
  thumbnail.pathname += `-${thumbnailSize(size)}`;
  return thumbnail;
};

/**
 * Fetch an image, following redirects manually so every hop is checked against the allowlist
 * (Cover Art Archive redirects to archive.org; anything else is refused)
 */
// Cover Art Archive runs on MetaBrainz servers (same as MusicBrainz): an album grid fires dozens
// of cover requests at once, so space requests to coverartarchive.org out (4 per second)
const waitForCoverArtSlot = createRateLimiter('__coverArtRateLimiterQueue', 250).wait;

const fetchAllowedImage = async (startUrl: URL): Promise<Response> => {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.hostname === 'coverartarchive.org') {
      await waitForCoverArtSlot();
    }
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

// A cover that Cover Art Archive answered 404 for is not asked for again for this long
const MISSING_COVER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Browsers may reuse the 404 for a day (the grid shows its fallback without asking the server)
const MISSING_COVER_MAX_AGE_SECONDS = 24 * 60 * 60;

const isKnownMissing = (imageUrl: string): boolean => {
  try {
    return Date.now() - fs.statSync(missingMarkerFor(imageUrl)).mtimeMs < MISSING_COVER_TTL_MS;
  } catch {
    return false;
  }
};

const missingResponse = () =>
  NextResponse.json(
    { error: 'Failed to fetch image: 404' },
    { status: 404, headers: { 'Cache-Control': `public, max-age=${MISSING_COVER_MAX_AGE_SECONDS}` } }
  );

type Download = { buffer: Buffer } | { status: number } | { tooLarge: true };

// Downloads in flight by thumbnail URL, so a grid card and the details panel never fetch the same file twice
const pendingStore = globalThis as typeof globalThis & { __imageDownloadsPending?: Map<string, Promise<Download>> };

const download = (sourceUrl: URL): Promise<Download> => {
  const pending = (pendingStore.__imageDownloadsPending ??= new Map());
  const key = sourceUrl.toString();
  let result = pending.get(key);
  if (!result) {
    result = (async (): Promise<Download> => {
      const response = await fetchAllowedImage(sourceUrl);
      if (!response.ok) {
        await response.body?.cancel();
        return { status: response.status };
      }
      const buffer = await readLimitedBody(response);
      return buffer ? { buffer } : { tooLarge: true };
    })().finally(() => pending.delete(key));
    pending.set(key, result);
  }
  return result;
};

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
    const cachePath = cachePathFor(imageUrl, width, height);

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

    // Albums without cover art: answered from the marker instead of asking Cover Art Archive again
    if (isKnownMissing(imageUrl)) {
      return missingResponse();
    }

    // Security: Validate URL against allowlist to prevent SSRF attacks
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
    } catch {
      // If URL parsing fails, it might be a relative URL - reject for security
      console.warn(`⚠️ Invalid or relative URL rejected: ${imageUrl}`);
      return NextResponse.json(
        { error: 'Invalid image URL format' },
        { status: 400 }
      );
    }

    // Fetch the original image (or the Cover Art Archive thumbnail for this size)
    const requestedSize = Math.max(width, height);
    let result: Download;
    try {
      result = await download(toCoverArtThumbnail(parsedUrl, requestedSize));
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
        console.error(`❌ Error fetching image ${imageUrl}:`, error);
      }

      return NextResponse.json(
        { error: `Failed to fetch image: ${errorMessage}` },
        { status: 500 }
      );
    }

    if ('status' in result) {
      // 404s are expected for albums without cover art: remember them (other errors are retried next time)
      if (result.status === 404) {
        console.log(`ℹ️ Cover art not found (expected, remembered for 7 days): ${imageUrl}`);
        fs.writeFileSync(missingMarkerFor(imageUrl), '');
        return missingResponse();
      }
      console.warn(`⚠️ Image fetch failed: ${imageUrl} - Status: ${result.status}`);
      return NextResponse.json(
        { error: `Failed to fetch image: ${result.status}` },
        { status: result.status }
      );
    }

    if ('tooLarge' in result) {
      console.warn(`⚠️ Image larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB refused: ${imageUrl}`);
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    // Square sizes made from the same Cover Art Archive thumbnail are stored together, so the
    // details panel (500 px) does not download the cover again after the grid (360 px) did
    const siblingSizes = isCoverArtImage(parsedUrl) && width === height
      ? ALLOWED_SIZES.filter(size => size !== width && thumbnailSize(size) === thumbnailSize(requestedSize))
      : [];

    // Generate a WebP thumbnail with sharp
    const { buffer } = result;
    const toWebp = (w: number, h: number) =>
      sharp(buffer).resize(w, h, { fit: 'cover' }).webp({ quality: QUALITY }).toBuffer();
    const webpImage = await toWebp(width, height);

    // Save to cache
    fs.writeFileSync(cachePath, webpImage);
    for (const size of siblingSizes) {
      const siblingPath = cachePathFor(imageUrl, size, size);
      if (!fs.existsSync(siblingPath)) {
        fs.writeFileSync(siblingPath, await toWebp(size, size));
      }
    }

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