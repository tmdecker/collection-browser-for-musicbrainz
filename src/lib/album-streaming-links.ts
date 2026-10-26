/**
 * @ai-file utility
 * @ai-description Resolves the streaming links of an album (release group) on the server
 * @ai-dependencies streaming-links-cache, release-group-cache, barcode-links, browse-releases, rate-limiter
 * @ai-features
 * - MusicBrainz url-rels of every release, one live link per platform (best release, then Digital Media, XW, rest)
 * - Dead links are skipped for the next candidate of the same platform (at most 3 checks per platform)
 * - Barcode lookups (Deezer, Apple Music, Spotify, Tidal) fill the platforms MusicBrainz lacks
 * - One cached result per album and country: fresh 30 days, or 1 hour when a lookup failed
 * - Stale results are returned right away and refreshed in the background (low priority)
 * - Used by /api/streaming-links (user clicks) and the prefetch (background), concurrent calls share one lookup
 */

import { Release, StreamingLinks } from '@/types/music';
import { getRgStreamingLinks, isRgStreamingLinksStale, setRgStreamingLinks, urlCheckCache } from '@/lib/cache/streaming-links-cache';
import { cacheManager } from '@/lib/cache/cache-manager';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { releaseGroupFetchInFlight } from '@/lib/cache/release-group-fetches';
import { getBarcodeLinksCached, isLookupBarcode } from '@/lib/barcode-links';
import { browseAllReleases } from '@/lib/browse-releases';
import { backOffMusicBrainz, waitForRateLimit, type RateLimitPriority } from '@/lib/rate-limiter';
import { extractAllStreamingUrls, getPlatformFromUrl, validateStreamingUrlServer } from '@/utils/streaming-links';
import { orderReleasesForStreaming, selectPreferredRelease } from '@/utils/release-selection';
import { getUserAgent } from '@/utils/config/userAgent';

const MAX_CHECKS_PER_PLATFORM = 3;
const MAX_BARCODES_PER_ALBUM = 2;

export interface AlbumReleases {
  releases: Release[];
  bestRelease?: Release;
}

/**
 * MusicBrainz candidate URLs per platform, in the order they should be tried
 * Best release first, then Digital Media, XW and the rest; duplicates are dropped
 */
export const collectPlatformCandidates = ({ releases, bestRelease }: AlbumReleases): Map<keyof StreamingLinks, string[]> => {
  const candidates = new Map<keyof StreamingLinks, string[]>();
  const ordered = [bestRelease, ...orderReleasesForStreaming(releases.filter(release => release.id !== bestRelease?.id))];

  for (const release of ordered) {
    if (!release) continue;
    for (const url of extractAllStreamingUrls(release)) {
      const platform = getPlatformFromUrl(url);
      if (!platform) continue;
      const urls = candidates.get(platform) ?? [];
      if (!urls.includes(url)) urls.push(url);
      candidates.set(platform, urls);
    }
  }

  return candidates;
};

/**
 * Barcodes to try for an album: the best release first, then other releases (distinct, valid only)
 */
export const candidateBarcodes = ({ releases, bestRelease }: AlbumReleases): string[] => {
  const barcodes: string[] = [];
  for (const release of [bestRelease, ...releases]) {
    const barcode = release?.barcode?.trim();
    if (isLookupBarcode(barcode) && !barcodes.includes(barcode)) {
      barcodes.push(barcode);
    }
    if (barcodes.length >= MAX_BARCODES_PER_ALBUM) break;
  }
  return barcodes;
};

// URL liveness results are stored per URL (30 days), so releases and albums that share a link share the check
const isUrlAlive = async (url: string): Promise<boolean> => {
  const cached = urlCheckCache.getFresh(url);
  if (cached) {
    return cached.valid;
  }

  const valid = await validateStreamingUrlServer(url);
  urlCheckCache.set(url, { valid });
  return valid;
};

/**
 * First live URL of each platform (platforms are checked in parallel)
 */
const pickLiveLinks = async (candidates: Map<keyof StreamingLinks, string[]>): Promise<StreamingLinks> => {
  const picks = await Promise.all(
    [...candidates].map(async ([platform, urls]) => {
      for (const url of urls.slice(0, MAX_CHECKS_PER_PLATFORM)) {
        if (await isUrlAlive(url)) return [platform, url] as const;
      }
      return null;
    })
  );

  const links: StreamingLinks = {};
  for (const pick of picks) {
    if (pick) links[pick[0]] = pick[1];
  }
  return links;
};

/**
 * Releases with url-rels: from the server cache when complete, otherwise browsed from MusicBrainz
 */
const loadAlbumReleases = async (releaseGroupMbid: string, priority: RateLimitPriority): Promise<AlbumReleases> => {
  if (!cacheManager.isInitialized()) {
    await cacheManager.initialize();
  }

  // The details route or the prefetch is loading this album right now: use its releases instead
  // of browsing them a second time (the panel asks for links and details at the same moment)
  const inFlight = releaseGroupFetchInFlight(releaseGroupMbid);
  if (inFlight) await inFlight;

  if (releaseGroupCache.isFullyCached(releaseGroupMbid)) {
    const cached = releaseGroupCache.getWithReleases(releaseGroupMbid);
    // Releases cached before browsing included url-rels have no relations
    if (cached && cached.releases.every(release => release.relations)) {
      return { releases: cached.releases, bestRelease: cached.bestRelease };
    }
  }

  const releases = await browseAllReleases(releaseGroupMbid, async url => {
    await waitForRateLimit(priority);
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': getUserAgent() },
    });
    if (response.status === 503) backOffMusicBrainz(response);
    return response;
  });
  return { releases, bestRelease: selectPreferredRelease(releases) ?? undefined };
};

const resolveAlbumStreamingLinks = async (
  releaseGroupMbid: string,
  country: string,
  albumReleases: AlbumReleases
): Promise<{ links: StreamingLinks; complete: boolean }> => {
  const links = await pickLiveLinks(collectPlatformCandidates(albumReleases));
  let complete = true;

  // Barcode lookups only fill platforms MusicBrainz has no live link for
  for (const barcode of candidateBarcodes(albumReleases)) {
    const { links: barcodeLinks, failed } = await getBarcodeLinksCached(barcode, country);
    if (failed) complete = false;
    const found = Object.keys(barcodeLinks).length > 0;
    for (const [platform, url] of Object.entries(barcodeLinks) as [keyof StreamingLinks, string][]) {
      links[platform] ??= url;
    }
    if (found) break;
  }

  const platforms = Object.keys(links);
  console.log(`🔗 Streaming links for ${releaseGroupMbid} (${country}): ${platforms.join(', ') || 'none'}`);
  return { links, complete };
};

// Lookups in flight, so a click during the prefetch of the same album waits for that lookup
const pendingStore = globalThis as typeof globalThis & {
  __albumStreamingLinksPending?: Map<string, Promise<StreamingLinks>>;
};

/**
 * Streaming links of an album, from the cache or resolved and cached
 * @param options.releases - Releases the caller already has (prefetch), saves loading them again
 * @param options.priority - MusicBrainz rate limit priority when releases must be loaded
 */
export const getAlbumStreamingLinks = async (
  releaseGroupMbid: string,
  country: string,
  options: { releases?: AlbumReleases; priority?: RateLimitPriority } = {}
): Promise<{ links: StreamingLinks; fromCache: boolean }> => {
  const cached = getRgStreamingLinks(releaseGroupMbid, country);
  if (cached) {
    if (isRgStreamingLinksStale(releaseGroupMbid, country)) {
      const refresh = lookUpAndStore(releaseGroupMbid, country, options.releases, 'low');
      if (options.releases) {
        // The prefetch is background work already: refresh now, with the releases it just loaded
        return { links: await refresh, fromCache: false };
      }
      // Clicks get the stale links right away; the refresh runs behind them
      refresh.catch(error => console.warn(`⚠️ Background refresh of streaming links for ${releaseGroupMbid} failed:`, error));
    }
    return { links: cached.streamingLinks, fromCache: true };
  }

  return { links: await lookUpAndStore(releaseGroupMbid, country, options.releases, options.priority ?? 'high'), fromCache: false };
};

/**
 * Resolve and cache an album's streaming links; concurrent calls for the same album share one lookup
 */
const lookUpAndStore = (
  releaseGroupMbid: string,
  country: string,
  releases: AlbumReleases | undefined,
  priority: RateLimitPriority
): Promise<StreamingLinks> => {
  const pending = (pendingStore.__albumStreamingLinksPending ??= new Map());
  const pendingKey = `${releaseGroupMbid}:${country}`;
  let lookup = pending.get(pendingKey);
  if (!lookup) {
    lookup = (async () => {
      const albumReleases = releases ?? (await loadAlbumReleases(releaseGroupMbid, priority));
      const { links, complete } = await resolveAlbumStreamingLinks(releaseGroupMbid, country, albumReleases);
      setRgStreamingLinks(releaseGroupMbid, country, links, complete);
      return links;
    })().finally(() => pending.delete(pendingKey));
    pending.set(pendingKey, lookup);
  }
  return lookup;
};
