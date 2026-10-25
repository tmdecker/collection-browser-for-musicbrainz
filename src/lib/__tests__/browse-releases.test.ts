import { describe, expect, it, vi } from 'vitest';
import { browseAllReleases, MAX_RELEASE_PAGES, ReleaseBrowseError } from '@/lib/browse-releases';

const pageOf = (offset: number, size: number, total: number) =>
  new Response(
    JSON.stringify({
      'release-count': total,
      releases: Array.from({ length: size }, (_, i) => ({ id: `r${offset + i}`, title: 'Album' })),
    })
  );

const offsetOf = (url: string) => Number(new URL(url).searchParams.get('offset'));

describe('browseAllReleases (B13)', () => {
  it('loads every page of a release group with more than 100 releases', async () => {
    const fetchPage = vi.fn(async (url: string) => {
      const offset = offsetOf(url);
      return pageOf(offset, Math.min(100, 250 - offset), 250);
    });

    const releases = await browseAllReleases('rg', fetchPage);

    expect(releases).toHaveLength(250);
    expect(fetchPage.mock.calls.map(([url]) => offsetOf(url))).toEqual([0, 100, 200]);
    expect(new URL(fetchPage.mock.calls[0][0]).searchParams.get('inc')).toBe('media url-rels');
  });

  it('needs a single request for small release groups', async () => {
    const fetchPage = vi.fn(async () => pageOf(0, 7, 7));
    expect(await browseAllReleases('rg', fetchPage)).toHaveLength(7);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('stops after the page cap', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchPage = vi.fn(async (url: string) => pageOf(offsetOf(url), 100, 2000));
    expect(await browseAllReleases('rg', fetchPage)).toHaveLength(MAX_RELEASE_PAGES * 100);
  });

  it('throws when the first page fails and keeps loaded releases when a later one fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(browseAllReleases('rg', async () => new Response('', { status: 503 }))).rejects.toBeInstanceOf(
      ReleaseBrowseError
    );

    const releases = await browseAllReleases('rg', async url =>
      offsetOf(url) === 0 ? pageOf(0, 100, 150) : new Response('', { status: 503 })
    );
    expect(releases).toHaveLength(100);
  });
});
