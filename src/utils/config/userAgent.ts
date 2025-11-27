/**
 * @ai-file utility
 * @ai-description Centralized User-Agent configuration for MusicBrainz API requests
 * @ai-dependencies Environment variables from .env.local
 * @ai-features
 * - Formatted User-Agent string generation from env vars
 * - Falls back to defaults if env vars not set
 */

/**
 * Centralized configuration for MusicBrainz API User-Agent
 *
 * This ensures consistent User-Agent headers across all API requests
 * while maintaining credential information in .env.local file.
 */

/**
 * Returns properly formatted User-Agent string for MusicBrainz API
 * Uses environment variables from .env.local
 */
export const getUserAgent = (): string => {
  const appName = process.env.NEXT_PUBLIC_MUSICBRAINZ_APP_NAME || 'MusicLibraryViewer/1.0.0';
  const contactEmail = process.env.NEXT_PUBLIC_MUSICBRAINZ_CONTACT_EMAIL || 'your.email@example.com';
  return `${appName} (mailto:${contactEmail})`;
};
