/**
 * @ai-file api
 * @ai-description Streaming links for a release barcode (Deezer, Apple Music, optional Spotify/Tidal)
 * @ai-dependencies barcode-links
 * @ai-features
 * - GET /api/barcode-links?barcode=<UPC/EAN>&country=DE
 * - Server cache (7 days), including "nothing found", so each barcode is looked up once a week
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBarcodeLinksCached, isLookupBarcode } from '@/lib/barcode-links';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get('barcode');
  const country = searchParams.get('country') || 'DE';

  // Security: only plain barcodes and country codes become cache keys and API queries
  if (!isLookupBarcode(barcode) || !/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: 'Invalid barcode or country code' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getBarcodeLinksCached(barcode, country));
  } catch (error) {
    console.error(`❌ Barcode lookup failed for ${barcode}:`, error);
    return NextResponse.json({ links: {}, fromCache: false, error: 'Lookup failed' });
  }
}
