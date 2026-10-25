import { describe, expect, it } from 'vitest';
import { releaseGroupFetchInFlight, withReleaseGroupFetch } from '@/lib/cache/release-group-fetches';

describe('release group fetches in flight', () => {
  it('marks a fetch as in flight until it ends, so a second caller can wait for it', async () => {
    let finish!: () => void;
    const fetch = withReleaseGroupFetch('rg-1', () => new Promise<string>(resolve => (finish = () => resolve('done'))));

    const inFlight = releaseGroupFetchInFlight('rg-1');
    expect(inFlight).toBeDefined();
    expect(releaseGroupFetchInFlight('rg-2')).toBeUndefined();

    finish();
    await expect(fetch).resolves.toBe('done');
    await expect(inFlight).resolves.toBeUndefined();
    expect(releaseGroupFetchInFlight('rg-1')).toBeUndefined();
  });

  it('settles the marker without an error when the fetch fails', async () => {
    const fetch = withReleaseGroupFetch('rg-3', async () => {
      throw new Error('MusicBrainz down');
    });
    const inFlight = releaseGroupFetchInFlight('rg-3');

    await expect(fetch).rejects.toThrow('MusicBrainz down');
    await expect(inFlight).resolves.toBeUndefined();
    expect(releaseGroupFetchInFlight('rg-3')).toBeUndefined();
  });
});
