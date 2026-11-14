import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/safe-page-fetch', () => ({ fetchPublicPageStart: vi.fn() }));

import { fetchPublicPageStart } from '@/lib/safe-page-fetch';
import {
  archivedOriginal, deleteReviewUrls, getReviewLinks, languageFromHtml, languageFromSite, reviewUrlsFrom,
} from '@/lib/review-links';
import { releaseGroupCache } from '@/lib/cache/release-group-cache';
import { reviewPageCache, reviewUrlsCache } from '@/lib/cache/review-links-cache';

const RG = 'b1392450-e666-3926-a536-22c65f834433';
const review = (resource: string) => ({ type: 'review', url: { resource } });
const pageFetch = vi.mocked(fetchPublicPageStart);

describe('page language', () => {
  it('reads the html lang attribute, then og:locale', () => {
    expect(languageFromHtml('<!doctype html><html class="x" lang="en-GB"><head>')).toBe('en');
    expect(languageFromHtml('<html><head><meta property="og:locale" content="de_DE">')).toBe('de');
    expect(languageFromHtml('<html><head><title>x</title>')).toBeNull();
  });

  it('falls back to known sites, then the domain ending', () => {
    expect(languageFromSite('pitchfork.com')).toBe('en');
    expect(languageFromSite('example.de')).toBe('de');
    expect(languageFromSite('example.ch')).toBeNull();
    expect(languageFromSite('example.com')).toBeNull();
  });
});

describe('reviewUrlsFrom / archivedOriginal', () => {
  it('keeps only review relations, without duplicates', () => {
    const relations = [review('https://a.com/1'), { type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q1' } }, review('https://a.com/1')];
    expect(reviewUrlsFrom(relations)).toEqual(['https://a.com/1']);
  });

  it('finds the original of a web.archive.org link', () => {
    expect(archivedOriginal(new URL('https://web.archive.org/web/2010/http://www.cokemachineglow.com/x'))?.hostname).toBe('www.cokemachineglow.com');
    expect(archivedOriginal(new URL('https://pitchfork.com/x'))).toBeNull();
  });
});

describe('getReviewLinks', () => {
  beforeEach(() => {
    releaseGroupCache.clear();
    reviewUrlsCache.clear();
    reviewPageCache.clear();
    pageFetch.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the cached release group url-rels, drops dead pages and names the sites', async () => {
    releaseGroupCache.set(RG, {
      id: RG,
      relations: [
        review('https://www.plattentests.de/rezi.php?show=1'),
        review('https://pitchfork.com/reviews/albums/x/'),
        review('https://gone.example.com/review'),
        review('https://web.archive.org/web/2009/http://www.cokemachineglow.com/record_review/1'),
      ],
    } as never);
    pageFetch.mockImplementation(async url =>
      url.includes('gone') ? { status: 404 } : url.includes('pitchfork') ? { status: 200, html: '<html lang="en-US">' } : { status: 403 }
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const links = await getReviewLinks(RG);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(links).toEqual([
      { url: 'https://www.plattentests.de/rezi.php?show=1', site: 'Plattentests.de', host: 'plattentests.de', language: 'de', archived: false },
      { url: 'https://pitchfork.com/reviews/albums/x/', site: 'Pitchfork', host: 'pitchfork.com', language: 'en', archived: false },
      {
        url: 'https://web.archive.org/web/2009/http://www.cokemachineglow.com/record_review/1',
        site: 'Cokemachineglow', host: 'cokemachineglow.com', language: 'en', archived: true,
      },
    ]);
    // Archived pages are not opened; the others are opened once and cached
    expect(pageFetch).toHaveBeenCalledTimes(3);
    await getReviewLinks(RG);
    expect(pageFetch).toHaveBeenCalledTimes(3);
  });

  it('asks MusicBrainz for url-rels when the cached album has none, and keeps the answer', async () => {
    releaseGroupCache.set(RG, { id: RG } as never);
    pageFetch.mockResolvedValue({ status: 200, html: '<html lang="fr">' });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ relations: [review('https://example.com/r')] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await getReviewLinks(RG)).toEqual([
      { url: 'https://example.com/r', site: 'example.com', host: 'example.com', language: 'fr', archived: false },
    ]);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain(`/release-group/${RG}?fmt=json&inc=url-rels`);
    await getReviewLinks(RG);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    deleteReviewUrls(RG);
    await getReviewLinks(RG);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
