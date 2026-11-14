/**
 * @ai-file utility
 * @ai-description Short facts about a release for the Releases tab: year, format, country, label, catalogue number
 * @ai-dependencies Release type, release-selection
 * @ai-features
 * - Format from the media: "2×CD", "12″ Vinyl", "CD + DVD-Video"
 * - Format group for the filter chips: Vinyl, CD, Digital, Cassette, Other
 * - Sort order: oldest first, undated last
 */

import { Release } from '@/types/music';
import { trackCount } from './release-selection';

export type FormatGroup = 'Vinyl' | 'CD' | 'Digital' | 'Cassette' | 'Other';
export const FORMAT_GROUPS: FormatGroup[] = ['Vinyl', 'CD', 'Digital', 'Cassette', 'Other'];

export interface ReleaseSummary {
  id: string;
  year: string;
  date: string;
  /** "2×CD", "12″ Vinyl", "CD + DVD-Video"; "Unknown format" when MusicBrainz has none */
  format: string;
  formatGroup: FormatGroup;
  country: string;
  /** Labels, joined with " / " */
  label: string;
  catalogNumber: string;
  tracks: number;
  /** Status when it is not Official (Promotion, Bootleg, Pseudo-Release) */
  unofficialStatus: string | null;
  disambiguation: string;
}

/** 12" -> 12″ (MusicBrainz writes inches with a plain quote) */
const prettyFormat = (format: string): string => format.replace(/(\d)"/g, '$1″');

export const releaseFormat = (release: Release): string => {
  const counts = new Map<string, number>();
  for (const medium of release.media ?? []) {
    const format = prettyFormat(medium.format || 'Unknown format');
    counts.set(format, (counts.get(format) ?? 0) + 1);
  }
  if (counts.size === 0) return 'Unknown format';
  return [...counts].map(([format, count]) => (count > 1 ? `${count}×${format}` : format)).join(' + ');
};

export const formatGroupOf = (format: string): FormatGroup => {
  if (/vinyl/i.test(format)) return 'Vinyl';
  if (/\bCD\b|SACD|HDCD/i.test(format)) return 'CD';
  if (/digital/i.test(format)) return 'Digital';
  if (/cassette/i.test(format)) return 'Cassette';
  return 'Other';
};

export const summarizeRelease = (release: Release): ReleaseSummary => {
  const labelInfo = release['label-info'] ?? [];
  const labels = [...new Set(labelInfo.map(info => info?.label?.name).filter(Boolean))];
  const catalogNumbers = [...new Set(labelInfo.map(info => info?.['catalog-number']).filter(Boolean))];
  const format = releaseFormat(release);
  return {
    id: release.id,
    year: release.date?.slice(0, 4) ?? '',
    date: release.date ?? '',
    format,
    formatGroup: formatGroupOf(format),
    country: release.country ?? '',
    label: labels.join(' / '),
    catalogNumber: catalogNumbers.join(' / '),
    tracks: trackCount(release),
    unofficialStatus: release.status && release.status !== 'Official' ? release.status : null,
    disambiguation: release.disambiguation ?? '',
  };
};

/** Oldest first; undated releases last; same date: country, then id (stable) */
export const sortReleasesByDate = (releases: ReleaseSummary[]): ReleaseSummary[] =>
  [...releases].sort((a, b) =>
    (a.date || '9999').localeCompare(b.date || '9999') ||
    a.country.localeCompare(b.country) ||
    a.id.localeCompare(b.id)
  );
