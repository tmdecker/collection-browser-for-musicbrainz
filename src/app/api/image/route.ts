/**
 * @ai-file api
 * @ai-description Custom image optimization API that resizes, converts, and caches images
 * @ai-dependencies Next.js, sharp, node:crypto, node:fs, node:path
 * @ai-features
 * - Resizes images to specified dimensions (w, h params, default 180x180)
 * - Converts images to WebP format with quality parameter (q, default 80)
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

// Security: Maximum dimensions to prevent resource exhaustion
const MAX_IMAGE_DIMENSION = 2000;
const MIN_IMAGE_DIMENSION = 1;
const MAX_QUALITY = 100;
const MIN_QUALITY = 1;

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

    // Security: Validate and clamp image dimensions to prevent DoS
    const rawWidth = parseInt(searchParams.get('w') || '180');
    const rawHeight = parseInt(searchParams.get('h') || '180');
    const rawQuality = parseInt(searchParams.get('q') || '80');

    const width = isNaN(rawWidth) ? 180 : Math.min(MAX_IMAGE_DIMENSION, Math.max(MIN_IMAGE_DIMENSION, rawWidth));
    const height = isNaN(rawHeight) ? 180 : Math.min(MAX_IMAGE_DIMENSION, Math.max(MIN_IMAGE_DIMENSION, rawHeight));
    const quality = isNaN(rawQuality) ? 80 : Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, rawQuality));
    
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

    try {
      // Parse the URL to extract hostname
      const parsedUrl = new URL(imageUrl);

      // Check if hostname is in allowlist
      const isAllowed = ALLOWED_IMAGE_HOSTS.some(allowedHost =>
        parsedUrl.hostname === allowedHost || parsedUrl.hostname.endsWith(`.${allowedHost}`)
      );

      if (!isAllowed) {
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
      imageResponse = await fetch(fullImageUrl, {
        cache: 'no-store' // Disable Next.js fetch cache (we use disk cache instead)
      });

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
    
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Generate a WebP thumbnail with sharp
    const webpImage = await sharp(Buffer.from(imageBuffer))
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