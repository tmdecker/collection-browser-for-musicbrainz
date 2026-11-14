import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAllReleaseGroupsInCollection, fetchAllReleaseGroupsInSeries, RELEASE_COLLECTION_INC } from '../release-groups-helper';
import { mbApi } from '../api';

vi.mock('../api', () => ({ mbApi: { get: vi.fn() } }));
const get = vi.mocked(mbApi.get);

const release = (id: string) => ({
  id, title: `Release ${id}`, date: '2016', 'release-group': { id: `rg-${id}`, 'primary-type': 'Album' },
  media: [{ format: 'CD', 'track-count': 10, position: 1 }],
});

describe('collection and series loading', () => {
  beforeEach(() => {
    get.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('loads a release collection as release items', async () => {
    get.mockImplementation(async (path: string) => path.startsWith('/collection/')
      ? { data: { name: 'CDs', 'entity-type': 'release', 'release-count': 2 } }
      : { data: { releases: [release('a'), release('b')] }, headers: {} });

    const { releaseGroups, collectionName } = await fetchAllReleaseGroupsInCollection('c1');

    expect(collectionName).toBe('CDs');
    expect(get.mock.calls[1][0]).toBe('/release');
    expect(get.mock.calls[1][1]?.params).toMatchObject({ collection: 'c1', inc: RELEASE_COLLECTION_INC, limit: 100, offset: 0 });
    expect(releaseGroups.map(item => item.id)).toEqual(['a', 'b']);
    expect(releaseGroups[0].releaseGroupId).toBe('rg-a');
    expect(releaseGroups[0].pinnedRelease?.format).toBe('CD');
  });

  it('still loads a release group collection through the release group browse', async () => {
    get.mockImplementation(async (path: string) => path.startsWith('/collection/')
      ? { data: { name: 'Albums', 'entity-type': 'release_group', 'release-group-count': 1 } }
      : { data: { 'release-groups': [{ id: 'rg-1', title: 'Album' }] }, headers: {} });

    const { releaseGroups } = await fetchAllReleaseGroupsInCollection('c1');

    expect(get.mock.calls[1][0]).toBe('/release-group');
    expect((get.mock.calls[1][1]?.params as Record<string, unknown>).inc).toBe('artist-credits+genres+tags+ratings');
    expect(releaseGroups[0].id).toBe('rg-1');
    expect(releaseGroups[0].pinnedRelease).toBeUndefined();
  });

  it('loads a release series in series order, each release as a release item', async () => {
    get.mockResolvedValue({ data: { name: 'Reissues', relations: [
      { type: 'part of', 'target-type': 'release', 'ordering-key': 2, release: { id: 'b', title: 'Vol. 2', date: '2017' } },
      { type: 'part of', 'target-type': 'release', 'ordering-key': 1, release: { id: 'a', title: 'Vol. 1', date: '2016' } },
      { type: 'part of', 'target-type': 'url' },
    ] } });

    const { releaseGroups, collectionName } = await fetchAllReleaseGroupsInSeries('s1');

    expect(collectionName).toBe('Reissues');
    expect((get.mock.calls[0][1]?.params as Record<string, unknown>).inc).toBe('release-group-rels+release-rels+artist-credits');
    expect(releaseGroups.map(item => [item.id, item.seriesOrder])).toEqual([['b', 2], ['a', 1]]);
    expect(releaseGroups[0].pinnedRelease).toEqual({ date: '2017', country: undefined, format: undefined });
    expect(releaseGroups[0].releaseGroupId).toBeUndefined();
  });

  it('keeps loading a release group series as before', async () => {
    get.mockResolvedValue({ data: { name: 'Best of', relations: [
      { type: 'part of', 'target-type': 'release_group', 'ordering-key': 1, release_group: { id: 'rg-1', title: 'Album' } },
    ] } });

    const { releaseGroups } = await fetchAllReleaseGroupsInSeries('s1');

    expect(releaseGroups).toHaveLength(1);
    expect(releaseGroups[0].seriesOrder).toBe(1);
    expect(releaseGroups[0].pinnedRelease).toBeUndefined();
  });
});
