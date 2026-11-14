import { beforeEach, describe, expect, it } from 'vitest';
import { openCacheDatabase, setCacheDatabase } from '../cache/database';
import { clearReleaseChoice, getReleaseChoice, setReleaseChoice } from '../release-choices';

describe('release choices', () => {
  beforeEach(() => {
    setCacheDatabase(openCacheDatabase(':memory:'));
  });

  it('has no choice until one is made', () => {
    expect(getReleaseChoice('rg-1')).toBeNull();
  });

  it('keeps the latest choice per release group', () => {
    setReleaseChoice('rg-1', 'release-a');
    setReleaseChoice('rg-1', 'release-b');
    setReleaseChoice('rg-2', 'release-c');
    expect(getReleaseChoice('rg-1')).toBe('release-b');
    expect(getReleaseChoice('rg-2')).toBe('release-c');
  });

  it('goes back to automatic when cleared', () => {
    setReleaseChoice('rg-1', 'release-a');
    clearReleaseChoice('rg-1');
    expect(getReleaseChoice('rg-1')).toBeNull();
  });
});
