import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { candidateBarcodes, collectPlatformCandidates, getAlbumStreamingLinks } from '@/lib/album-streaming-links';
import { getRgStreamingLinks, streamingLinksCache } from '@/lib/cache/streaming-links-cache';
import { Media, Release } from '@/types/music';

const release = (overrides: Partial<Release>): Release => ({ id: 'r', title: 'Album', ...overrides }) as Release;
const digital = [{ format: 'Digital Media' }] as Media[];
const streaming = (...urls: string[]) =>
  urls.map(resource => ({ type: 'streaming', url: { resource } })) as unknown as Release['relations'];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const RG = 'b1392450-e666-3926-a536-22c65f834433';

describe('collectPlatformCandidates', () => {
  it('lists every URL per platform: best release first, then Digital Media, without duplicates', () => {
    const best = release({ id: 'best', relations: streaming('https://open.spotify.com/album/best') });
    const cdRelease = release({ id: 'cd', relations: streaming('https://open.spotify.com/album/cd') });
    const digitalRelease = release({
      id: 'digital',
      media: digital,
      relations: streaming('https://open.spotify.com/album/digital', 'https://artist.bandcamp.com/album/x', 'https://open.spotify.com/album/best'),
    });

    const candidates = collectPlatformCandidates({ releases: [cdRelease, digitalRelease, best], bestRelease: best });

    expect(candidates.get('spotify')).toEqual([
      'https://open.spotify.com/album/best',
      'https://open.spotify.com/album/digital',
      'https://open.spotify.com/album/cd',
    ]);
    expect(candidates.get('bandcamp')).toEqual(['https://artist.bandcamp.com/album/x']);
  });

  it('ignores non-streaming hosts', () => {
    const candidates = collectPlatformCandidates({
      releases: [release({ relations: streaming('https://example.com/album/1') })],
    });
    expect(candidates.size).toBe(0);
  });
});

describe('candidateBarcodes', () => {
  it('takes the best release first and at most two distinct valid barcodes', () => {
    const releases = [
      release({ id: 'a', barcode: '886443927087' }),
      release({ id: 'b', barcode: 'none' }),
      release({ id: 'c', barcode: '4006381333931' }),
      release({ id: 'd', barcode: '5099749994324' }),
    ];
    expect(candidateBarcodes({ releases, bestRelease: releases[2] })).toEqual(['4006381333931', '886443927087']);
  });
});

describe('getAlbumStreamingLinks', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    streamingLinksCache.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url === 'https://open.spotify.com/album/dead') return new Response(null, { status: 404 });
      if (url.startsWith('https://open.spotify.com') || url.includes('bandcamp.com')) return new Response(null, { status: 200 });
      if (url.startsWith('https://api.deezer.com')) return json({ link: 'https://www.deezer.com/album/1' });
      if (url.startsWith('https://itunes.apple.com')) return json({ results: [] });
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('skips dead MusicBrainz links, fills gaps by barcode and caches the album for 30 days', async () => {
    const best = release({
      id: 'best',
      barcode: '886443927087',
      relations: streaming('https://open.spotify.com/album/dead', 'https://artist.bandcamp.com/album/x'),
    });
    const other = release({ id: 'other', relations: streaming('https://open.spotify.com/album/live') });

    const result = await getAlbumStreamingLinks(RG, 'DE', { releases: { releases: [best, other], bestRelease: best } });

    expect(result).toEqual({
      links: {
        spotify: 'https://open.spotify.com/album/live',
        bandcamp: 'https://artist.bandcamp.com/album/x',
        deezer: 'https://www.deezer.com/album/1',
      },
      fromCache: false,
    });
    const cached = getRgStreamingLinks(RG, 'DE');
    expect(cached?.complete).toBe(true);
    expect(cached!._expiresAt - cached!._cachedAt).toBe(30 * 24 * 60 * 60 * 1000);

    const again = await getAlbumStreamingLinks(RG, 'DE', { releases: { releases: [] } });
    expect(again).toEqual({ links: result.links, fromCache: true });
  });

  it('keeps a result with a failed barcode provider for 1 hour only', async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      if (String(input).startsWith('https://api.deezer.com')) throw new Error('timeout');
      return json({ results: [] });
    });

    const result = await getAlbumStreamingLinks(RG, 'DE', {
      releases: { releases: [release({ id: 'a', barcode: '886443927087' })] },
    });

    expect(result.links).toEqual({});
    const cached = getRgStreamingLinks(RG, 'DE');
    expect(cached?.complete).toBe(false);
    expect(cached!._expiresAt - cached!._cachedAt).toBe(60 * 60 * 1000);
  });
});
