/**
 * @ai-file api
 * @ai-description Checks whether a streaming platform URL is still alive (not 404/gone)
 * @ai-dependencies validateStreamingUrlServer from streaming-links
 * @ai-features
 * - Only accepts known streaming hosts (prevents SSRF)
 * - Validates every redirect hop against the same host list
 * - Bounded in-memory cache (24-hour TTL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isStreamingUrl, validateStreamingUrlServer } from '@/utils/streaming-links';

export const dynamic = 'force-dynamic';

// In-memory cache for URL validation results (24-hour TTL, oldest entries evicted first)
const validationCache = new Map<string, { valid: boolean; cachedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 1000;

export async function GET(request: NextRequest) {
  const url = new URL(request.url).searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  // Security: never request hosts other than known streaming platforms
  if (!isStreamingUrl(url)) {
    return NextResponse.json(
      { error: 'Not a supported streaming URL' },
      { status: 400 }
    );
  }

  // Check cache first
  const cached = validationCache.get(url);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json(
      { valid: cached.valid, cached: true },
      { headers: { 'Cache-Control': 'public, max-age=86400' } }
    );
  }

  const valid = await validateStreamingUrlServer(url);

  validationCache.delete(url);
  validationCache.set(url, { valid, cachedAt: Date.now() });
  if (validationCache.size > MAX_CACHE_ENTRIES) {
    // Map keeps insertion order, so the first key is the oldest entry
    validationCache.delete(validationCache.keys().next().value!);
  }

  return NextResponse.json(
    { valid },
    { headers: { 'Cache-Control': 'public, max-age=86400' } }
  );
}
