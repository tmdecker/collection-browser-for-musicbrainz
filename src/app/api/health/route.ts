/**
 * Health check endpoint for monitoring API availability
 * @ai Simple GET endpoint that returns 200 OK with basic status info
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'MusicBrainz GUI API',
    },
    { status: 200 }
  );
}
