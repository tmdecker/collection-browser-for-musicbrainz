/**
 * @ai-file utility
 * @ai-description Handler for fetching and processing MusicBrainz collection data with rate limiting
 * @ai-dependencies music types, release-groups-helper
 * @ai-features Collection fetching, rate limiting, cover art URLs, API proxy support
 */

import { ReleaseGroup } from '@/types/music';
import { fetchAllReleaseGroupsInCollection } from './release-groups-helper';

// Configuration options
interface CollectionConfig {
  collectionId: string;
  userAgent: string;
  enableCaching: boolean;
  logErrors: boolean;
}

// Get collection ID from localStorage configuration
const getConfiguredCollectionId = (): string => {
  if (typeof window !== 'undefined') {
    const savedConfig = localStorage.getItem('mbConfigOptions');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.collectionId) {
          return config.collectionId;
        }
      } catch (e) {
        console.error('Error parsing saved config:', e);
      }
    }
  }
  // Return empty string if no collection configured
  return '';
};

// Default configuration
const defaultConfig: CollectionConfig = {
  collectionId: getConfiguredCollectionId(), // Require user configuration
  userAgent: `${process.env.MUSICBRAINZ_APP_NAME} (mailto:${process.env.MUSICBRAINZ_CONTACT_EMAIL})`,
  enableCaching: false, // Caching disabled to ensure we get all data
  logErrors: true
};

/**
 * Fetches collection data from MusicBrainz 
 * Simplified approach that respects rate limits properly
 */
export const getCollection = async (
  customConfig?: Partial<CollectionConfig>
) => {
  // Merge default config with custom config
  const config = { ...defaultConfig, ...customConfig };
  
  console.log('Starting collection fetch with config:', config);
  console.log('⚠️ Rate limits fixed - waiting 2 seconds between requests now');
  
  // Check if collection ID is configured
  if (!config.collectionId) {
    throw new Error('No collection configured. Please go to Collection Browser and enter your MusicBrainz collection ID.');
  }

  try {
    // Always use API proxy to avoid CORS issues
    console.log('🔗 Using API proxy to avoid CORS issues...');
    console.log('🆔 Collection ID:', config.collectionId);
    console.log('👤 User Agent:', config.userAgent);

    const { releaseGroups, collectionName } = await fetchAllReleaseGroupsInCollection(
      config.collectionId,
      config.userAgent
    );

    console.log(`✅ Successfully fetched ${releaseGroups.length} release groups via API proxy`);

    // Add cover art URLs to each release group
    const releaseGroupsWithCovers = releaseGroups.map((rg: any) => ({
      ...rg,
      cover: `/api/coverart/release-group/${rg.id}/front`
    }));

    console.log(`🎨 Added cover art URLs to ${releaseGroupsWithCovers.length} albums`);
    return releaseGroupsWithCovers;
  } catch (error) {
    console.error('❌ API proxy failed:', error);
    console.error('🔍 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Re-throw the error to let the caller handle it
    throw error;
  }
};;
