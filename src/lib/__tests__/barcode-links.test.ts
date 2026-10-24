import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { barcodeVariants, isLookupBarcode, lookupLinksByBarcode } from '@/lib/barcode-links';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('barcode helpers', () => {
  it('tries the UPC-A and EAN-13 forms of a barcode', () => {
    expect(barcodeVariants('886443927087')).toEqual(['886443927087', '0886443927087']);
    expect(barcodeVariants('0886443927087')).toEqual(['0886443927087', '886443927087']);
    expect(barcodeVariants('4006381333931')).toEqual(['4006381333931']);
  });

  it('accepts only plain 8, 12, 13 or 14 digit barcodes', () => {
    expect(isLookupBarcode('886443927087')).toBe(true);
    expect(isLookupBarcode('12345678')).toBe(true);
    expect(isLookupBarcode('12345')).toBe(false);
    expect(isLookupBarcode('88644392708x')).toBe(false);
    expect(isLookupBarcode(null)).toBe(false);
  });
});

describe('lookupLinksByBarcode', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url === 'https://api.deezer.com/album/upc:886443927087') return json({ error: { code: 800 } });
      if (url === 'https://api.deezer.com/album/upc:0886443927087') return json({ link: 'https://www.deezer.com/album/6575789' });
      if (url.startsWith('https://itunes.apple.com/lookup')) {
        return json({ results: [{ collectionViewUrl: 'https://music.apple.com/de/album/x/617154241?uo=4' }] });
      }
      if (url === 'https://accounts.spotify.com/api/token') return json({ access_token: 'sp-token', expires_in: 3600 });
      if (url.startsWith('https://api.spotify.com/v1/search')) {
        return json({ albums: { items: [{ external_urls: { spotify: 'https://open.spotify.com/album/4m2880' } }] } });
      }
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('finds Deezer (second barcode form) and Apple Music without keys, skips Spotify and Tidal', async () => {
    const links = await lookupLinksByBarcode('886443927087', 'DE');

    expect(links).toEqual({
      deezer: 'https://www.deezer.com/album/6575789',
      appleMusic: 'https://music.apple.com/de/album/x/617154241',
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('spotify'))).toBe(false);
  });

  it('uses Spotify when client credentials are configured', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'secret');

    const links = await lookupLinksByBarcode('886443927087', 'DE');

    expect(links.spotify).toBe('https://open.spotify.com/album/4m2880');
    const search = fetchMock.mock.calls.find(([url]) => String(url).startsWith('https://api.spotify.com'));
    expect(String(search?.[0])).toContain('q=upc%3A886443927087');
  });

  it('keeps the other links when one provider fails', async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      if (String(input).startsWith('https://itunes.apple.com')) throw new Error('network down');
      if (String(input).startsWith('https://api.deezer.com')) return json({ link: 'https://www.deezer.com/album/1' });
      return json({}, 404);
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await lookupLinksByBarcode('886443927087', 'DE')).toEqual({ deezer: 'https://www.deezer.com/album/1' });
  });
});
