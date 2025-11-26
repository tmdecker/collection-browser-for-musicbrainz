/**
 * @ai-file utility
 * @ai-description Record label extraction and filtering from releaseDetails['label-info']
 * @ai-dependencies ReleaseGroup from @/types/music
 * @ai-features
 * - Extract and count unique labels from album.releaseDetails['label-info']
 * - Filter albums by selected labels with OR logic
 * - Search labels by substring matching (case-sensitive)
 */

import { ReleaseGroup } from '@/types/music';

export interface LabelStat {
  name: string;
  count: number;
}

/**
 * Extract label names from a single album's releaseDetails
 * Uses releaseDetails as the single source of truth for label information
 * Removes duplicate labels within the same release
 */
export const extractLabelsFromAlbum = (album: ReleaseGroup): string[] => {
  if (!album.releaseDetails?.['label-info']) {
    return [];
  }

  const labels = album.releaseDetails['label-info']
    .filter(labelInfo => labelInfo?.label?.name) // Filter out entries without valid label names
    .map(labelInfo => labelInfo.label.name);

  // Remove duplicates by converting to Set and back to array
  return Array.from(new Set(labels));
};

/**
 * Generate label statistics across all albums with releaseDetails
 * Only includes albums that have fetched release details with label information
 */
export const extractLabelStats = (albums: ReleaseGroup[]): LabelStat[] => {
  const labelCounts = new Map<string, number>();

  albums.forEach(album => {
    const labels = extractLabelsFromAlbum(album);
    labels.forEach(label => {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    });
  });

  // Convert to array and sort by count (highest first)
  return Array.from(labelCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Check if album matches any of the selected label filters
 * Uses OR logic: album matches if it has ANY of the selected labels
 */
export const albumMatchesLabelFilters = (
  album: ReleaseGroup,
  selectedLabels: string[]
): boolean => {
  if (selectedLabels.length === 0) {
    return true; // No filters applied
  }

  const albumLabels = extractLabelsFromAlbum(album);

  // Return true if album has any of the selected labels
  return selectedLabels.some(selectedLabel =>
    albumLabels.includes(selectedLabel)
  );
};

/**
 * Filter label statistics by search query
 * Performs case-insensitive substring matching on label names
 */
export const filterLabelsBySearch = (
  labelStats: LabelStat[],
  searchQuery: string
): LabelStat[] => {
  if (!searchQuery.trim()) {
    return labelStats;
  }

  const query = searchQuery.toLowerCase().trim();
  return labelStats.filter(label =>
    label.name.toLowerCase().includes(query)
  );
};

