/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Define device sizes for responsive images
    deviceSizes: [180, 360, 720, 1080],
    // Image formats to generate (WebP is efficient)
    formats: ['image/webp'],
    // Disable unoptimized mode since we're handling optimization
    unoptimized: false,
    // Remote image patterns for external hosts
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'coverartarchive.org',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '*.archive.org',
        pathname: '**',
      }
    ],
  },
  async rewrites() {
    return [
      // Note: /api/musicbrainz rewrite removed to allow OAuth authentication via API route handlers
      // The API route at src/app/api/musicbrainz/route.ts handles proxying with auth tokens
      {
        source: '/api/coverart/:path*',
        destination: 'https://coverartarchive.org/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
              "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
              "img-src 'self' https://coverartarchive.org https://*.archive.org data: blob:",
              "connect-src 'self' https://musicbrainz.org https://api.song.link https://music.apple.com",
              "font-src 'self' data:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://musicbrainz.org", // Allow OAuth form submission
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
