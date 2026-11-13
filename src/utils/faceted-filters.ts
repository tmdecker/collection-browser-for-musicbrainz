/**
 * @ai-file utility
 * @ai-description Filter matching and faceted chip counts for the filter panel
 * @ai-features
 * - One place that decides whether an album passes the active filters (genres, labels and tags are
 *   "any of" within a kind; kinds, the date range and the rating range must all match)
 * - Faceted counts: a chip counts the albums that pass the search and every OTHER kind of filter and
 *   carry that chip, i.e. how many albums would show with that chip added
 * - Chips with no such album are left out, except selected ones (count 0), so a filter can always be removed;
 *   selected chips come first, then by count
 */

import { ReleaseGroup } from '@/types/music';
import { albumMatchesGenreFilters, extractGenreStats, GenreStat, normalizeGenreName } from './genre-processor';
import { albumMatchesLabelFilters, extractLabelStats, LabelStat } from './label-processor';
import { albumMatchesTagFilters, extractTagStats, normalizeTagName, TagStat } from './tag-processor';
import { albumMatchesDateFilter, YearRange } from './date-processor';

export interface FilterSelection {
  genres: string[];
  labels: string[];
  tags: string[];
  /** Only when it narrows the collection's own year range */
  dateRange: YearRange | null;
  ratingRange: { min: number; max: number } | null;
}

type ChipKind = 'genres' | 'labels' | 'tags';

/** Does the album pass every active filter (leaving out one kind, for that kind's counts)? */
export const albumMatchesSelection = (album: ReleaseGroup, selection: FilterSelection, skip?: ChipKind): boolean => {
  if (skip !== 'genres' && !albumMatchesGenreFilters(album, selection.genres, true)) return false;
  if (skip !== 'labels' && !albumMatchesLabelFilters(album, selection.labels)) return false;
  if (skip !== 'tags' && !albumMatchesTagFilters(album, selection.tags)) return false;
  if (selection.dateRange && !albumMatchesDateFilter(album, selection.dateRange.min, selection.dateRange.max)) return false;
  if (selection.ratingRange) {
    const stars = album.rating?.average ?? null;
    if (stars === null || stars < selection.ratingRange.min || stars > selection.ratingRange.max) return false;
  }
  return true;
};

// Selected chips first (count 0 when no album is left for them), then the others as counted (most first)
const withSelectedFirst = <T extends { name: string; count: number }>(
  stats: T[],
  selected: string[],
  key: (name: string) => string,
  missing: (name: string) => T
): T[] => {
  const byKey = new Map(stats.map(stat => [key(stat.name), stat]));
  const selectedKeys = new Set(selected.map(key));
  const first = selected.map(name => byKey.get(key(name)) ?? missing(name));
  return [...first, ...stats.filter(stat => !selectedKeys.has(key(stat.name)))];
};

export interface FacetedStats {
  genreStats: GenreStat[];
  labelStats: LabelStat[];
  tagStats: TagStat[];
}

/** Chip counts for the filter panel, from the albums the search leaves */
export const facetedStats = (albums: ReleaseGroup[], selection: FilterSelection): FacetedStats => {
  const passing = (skip: ChipKind) => albums.filter(album => albumMatchesSelection(album, selection, skip));
  return {
    genreStats: withSelectedFirst(extractGenreStats(passing('genres'), true), selection.genres, normalizeGenreName,
      name => ({ name, count: 0, normalizedName: normalizeGenreName(name) })),
    labelStats: withSelectedFirst(extractLabelStats(passing('labels')), selection.labels, name => name,
      name => ({ name, count: 0 })),
    tagStats: withSelectedFirst(extractTagStats(passing('tags')), selection.tags, normalizeTagName,
      name => ({ name, count: 0, normalizedName: normalizeTagName(name) })),
  };
};
