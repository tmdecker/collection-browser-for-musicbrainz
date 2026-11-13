// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setChosenCover, useChosenCover } from '@/utils/collection-covers';

const COLLECTION = 'f4f5c9a0-1b2c-4d3e-8f9a-0b1c2d3e4f5a';
const RG = 'b1392450-e666-3926-a536-22c65f834433';
const OTHER_RG = '0e0c1a5b-2b6a-3b8a-9f3e-6c1f6a2d6b11';

const json = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

describe('collection covers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the server map, saves a choice and goes back when the server refuses', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (!init) return json({ covers: { [COLLECTION]: RG } });
      return json({}, init.method !== 'PUT' || !String(init.body).includes(OTHER_RG));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChosenCover(COLLECTION));
    await waitFor(() => expect(result.current).toBe(RG));

    let saved = true;
    await act(async () => { saved = await setChosenCover(COLLECTION, OTHER_RG); });
    expect(saved).toBe(false);
    expect(result.current).toBe(RG);

    await act(async () => { saved = await setChosenCover(COLLECTION, null); });
    expect(saved).toBe(true);
    expect(result.current).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(`/api/collection-covers/${COLLECTION}`, { method: 'DELETE' });
  });
});
