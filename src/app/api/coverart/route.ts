/**
 * @ai-file api
 * @ai-description API proxy for CoverArt Archive with fallback strategies and placeholder generation
 * @ai-dependencies Next.js server components, getUserAgent utility
 * @ai-features
 * - Proxies requests to CoverArtArchive.org to avoid CORS issues
 * - Multiple fallback strategies (release-group → release lookup)
 * - Generates SVG placeholders for missing covers
 * - 24-hour caching headers with size validation (>100 bytes)
 * - Always returns valid responses (never errors to client)
 */

import { NextResponse } from 'next/server';
import { getUserAgent } from '@/utils/config/userAgent';

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic';

// Create a simple SVG placeholder for missing covers
const placeholderSVG = `<svg width="250" height="250" xmlns="http://www.w3.org/2000/svg">
  <rect width="250" height="250" fill="#333" />
  <text x="125" y="125" font-family="Arial" font-size="20" text-anchor="middle" fill="#ccc">
    No Cover
  </text>
</svg>`;

export async function GET(request: Request) {
  try {
    const { pathname } = new URL(request.url);
    const path = pathname.replace('/api/coverart', '');
    
    // Parse the path to determine if we're requesting a release-group image
    const parts = path.split('/');
    const isReleaseGroup = parts[1] === 'release-group';
    const mbid = isReleaseGroup ? parts[2] : '';
    
    // Set up proper headers according to MusicBrainz guidelines
    const headers = {
      'User-Agent': getUserAgent(),
      'Accept': 'image/*'
    };
    
    // Initialize variables
    let validImage = false;
    let responseBlob;
    let contentType = 'image/svg+xml'; // Default to SVG
    
    if (isReleaseGroup) {
      // Try Strategy 1: CoverArtArchive API
      try {
        const url = `https://coverartarchive.org/release-group/${mbid}/front`;
        const response = await fetch(url, {
          headers,
          redirect: 'follow'
        });
        
        if (response.ok) {
          const ct = response.headers.get('content-type');
          if (ct && ct.includes('image/')) {
            responseBlob = await response.blob();
            if (responseBlob.size > 100) { // Ensure we got actual image data
              validImage = true;
              contentType = ct;
            }
          }
        } else {
          console.error(`❌ Cover art strategy 1 failed: ${url} - Status: ${response.status}`);
        }
      } catch (e) {
        console.error(`❌ Cover art strategy 1 error: ${mbid}`, e);
      }
      
      // Try Strategy 2: Release in the release-group
      if (!validImage) {
        try {
          const mbUrl = `https://musicbrainz.org/ws/2/release?release-group=${mbid}&fmt=json&limit=1`;
          const mbResponse = await fetch(mbUrl, {
            headers: {
              'User-Agent': getUserAgent(),
              'Accept': 'application/json'
            }
          });
          
          if (mbResponse.ok) {
            const releaseData = await mbResponse.json();
            if (releaseData.releases && releaseData.releases.length > 0) {
              const releaseId = releaseData.releases[0].id;
              
              const coverUrl = `https://coverartarchive.org/release/${releaseId}/front`;
              const response = await fetch(coverUrl, {
                headers,
                redirect: 'follow'
              });
              
              if (response.ok) {
                const ct = response.headers.get('content-type');
                if (ct && ct.includes('image/')) {
                  responseBlob = await response.blob();
                  if (responseBlob.size > 100) {
                    validImage = true;
                    contentType = ct;
                  }
                }
              } else {
                console.error(`❌ Cover art strategy 2 failed: ${coverUrl} - Status: ${response.status}`);
              }
            }
          } else {
            console.error(`❌ MusicBrainz release lookup failed: ${mbUrl} - Status: ${mbResponse.status}`);
          }
        } catch (e) {
          console.error(`❌ Cover art strategy 2 error: ${mbid}`, e);
        }
      }
    } else {
      // Regular release request
      try {
        const url = `https://coverartarchive.org${path}`;
        const response = await fetch(url, {
          headers,
          redirect: 'follow'
        });
        
        if (response.ok) {
          const ct = response.headers.get('content-type');
          if (ct && ct.includes('image/')) {
            responseBlob = await response.blob();
            if (responseBlob.size > 100) {
              validImage = true;
              contentType = ct;
            }
          }
        } else {
          console.error(`❌ Cover art failed: ${url} - Status: ${response.status}`);
        }
      } catch (e) {
        console.error(`❌ Cover art fetch error:`, e);
      }
    }
    
    // Return image or placeholder
    if (validImage && responseBlob) {
      return new NextResponse(responseBlob, {
        headers: {
          'content-type': contentType,
          'cache-control': 'public, max-age=86400'
        }
      });
    } else {
      return new NextResponse(placeholderSVG, {
        headers: {
          'content-type': 'image/svg+xml',
          'cache-control': 'public, max-age=86400'
        }
      });
    }
  } catch (error) {
    console.error('❌ Error in cover art API:', error);
    
    // Always return a valid image on error
    return new NextResponse(placeholderSVG, {
      headers: {
        'content-type': 'image/svg+xml',
        'cache-control': 'public, max-age=86400'
      }
    });
  }
}
