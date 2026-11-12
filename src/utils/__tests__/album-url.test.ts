import { describe, expect, it } from 'vitest';
import { albumFromUrl, urlWithAlbum } from '../album-url';

const RG = '1d4e4fd0-9b0b-3a5a-8a8c-6b3c1d3b5a2f';
const BASE = 'https://example.org/series/27a3c068-3ec5-421a-ad12-599d085fdeb1?collection=abc';

describe('album in the address', () => {
  it('adds and removes the album, keeping the rest of the address', () => {
    const withAlbum = urlWithAlbum(BASE, RG);
    expect(withAlbum).toBe(`/series/27a3c068-3ec5-421a-ad12-599d085fdeb1?collection=abc&album=${RG}`);
    expect(urlWithAlbum(`https://example.org${withAlbum}`, null)).toBe('/series/27a3c068-3ec5-421a-ad12-599d085fdeb1?collection=abc');
  });

  it('reads back only real MBIDs', () => {
    expect(albumFromUrl(`https://example.org/collection/x?album=${RG.toUpperCase()}`)).toBe(RG);
    expect(albumFromUrl('https://example.org/collection/x?album=nonsense')).toBeNull();
    expect(albumFromUrl('https://example.org/collection/x')).toBeNull();
  });
});
