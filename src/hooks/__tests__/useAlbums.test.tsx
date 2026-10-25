// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '@/hooks/usePreferences';
import { useAlbums } from '@/hooks/useAlbums';
import { ReleaseGroup } from '@/types/music';

// Each getBasicData call returns a promise the test resolves by hand
const pendingLoads = new Map<string, (albums: ReleaseGroup[]) => void>();
vi.mock('@/utils/progressive-loader', () => ({
  getBasicData: (collectionId: string) =>
    new Promise<ReleaseGroup[]>(resolve => pendingLoads.set(collectionId, resolve)),
}));


const album = (id: string): ReleaseGroup => ({ id, title: id, artist_credit: [] });
const wrapper = ({ children }: { children: ReactNode }) => <PreferencesProvider>{children}</PreferencesProvider>;

beforeEach(() => {
  pendingLoads.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAlbums (B11)', () => {
  it('ignores a slow response for a collection the user already left', async () => {
    const { result, rerender } = renderHook(({ id }) => useAlbums(id), {
      wrapper,
      initialProps: { id: 'collection-a' },
    });
    await waitFor(() => expect(pendingLoads.has('collection-a')).toBe(true));

    rerender({ id: 'collection-b' });
    await waitFor(() => expect(pendingLoads.has('collection-b')).toBe(true));

    // B answers first, then the old request for A arrives late
    await act(async () => pendingLoads.get('collection-b')!([album('b-1')]));
    await act(async () => pendingLoads.get('collection-a')!([album('a-1'), album('a-2')]));

    expect(result.current.rawAlbums.map(a => a.id)).toEqual(['b-1']);
    expect(result.current.loading).toBe(false);
  });
});
