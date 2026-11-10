/**
 * @ai-file utility
 * @ai-description Sorting by artist the way a record shelf does: by the artist's sort name, then by year
 * @ai-dependencies ReleaseGroup from @/types/music
 * @ai-features
 * - Uses the MusicBrainz sort name of the first credited artist ("Velvet Underground, The", "Bowie, David")
 * - Falls back to the display name when an artist has no sort name
 * - Albums of the same artist come oldest first, then by title, in both directions
 */

import { ReleaseGroup } from '@/types/music';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

type ArtistWithSortName = { name?: string; sort_name?: string; 'sort-name'?: string };

/** Sort key of an album's first credited artist */
export const artistSortName = (album: ReleaseGroup): string => {
  const credit = album.artist_credit?.[0];
  const artist = credit?.artist as ArtistWithSortName | undefined;
  return artist?.['sort-name'] || artist?.sort_name || artist?.name || credit?.name || '';
};

/**
 * Sort albums by artist (A to Z or Z to A); within one artist always oldest first, then by title
 */
export const sortByArtist = (albums: ReleaseGroup[], direction: 'asc' | 'desc'): ReleaseGroup[] => {
  const keys = new Map(albums.map(album => [album, artistSortName(album)]));
  return [...albums].sort((a, b) => {
    const byArtist = collator.compare(keys.get(a)!, keys.get(b)!);
    if (byArtist !== 0) return direction === 'asc' ? byArtist : -byArtist;
    const byDate = (a.first_release_date || '9999').localeCompare(b.first_release_date || '9999');
    if (byDate !== 0) return byDate;
    return collator.compare(a.title, b.title);
  });
};
