// @vitest-environment jsdom
import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { PreferencesProvider } from '@/hooks/usePreferences';

const wrapper = ({ children }: { children: ReactNode }) => (
  <PreferencesProvider>
    <AuthProvider>{children}</AuthProvider>
  </PreferencesProvider>
);

const HOUR = 60 * 60 * 1000;
const user = { id: '1', name: 'tim' };

const setExpiryCookie = (expiresAt: number) => {
  document.cookie = `mb_token_expires_at=${expiresAt}; path=/`;
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;
const calls = (path: string) => fetchMock.mock.calls.filter(([url]) => url === path).length;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/auth/refresh') return json({ expires_at: Date.now() + HOUR, scope: 'profile' });
    if (url === '/api/auth/profile') return json(user);
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.cookie = 'mb_token_expires_at=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  localStorage.clear();
});

describe('useAuth', () => {
  it('stays logged out without a token cookie', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.authState.status).toBe('unauthenticated');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an expired token once on reload and still loads the profile (B1)', async () => {
    setExpiryCookie(Date.now() - HOUR);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(user));
    expect(result.current.isAuthenticated).toBe(true);
    expect(calls('/api/auth/refresh')).toBe(1);
  });

  it('runs one refresh for several components (B2)', async () => {
    setExpiryCookie(Date.now() - HOUR);
    const Consumer = () => {
      useAuth();
      return null;
    };

    render(
      <>
        <Consumer />
        <Consumer />
      </>,
      { wrapper }
    );

    await waitFor(() => expect(calls('/api/auth/profile')).toBe(1));
    expect(calls('/api/auth/refresh')).toBe(1);
  });

  it('shares one in-flight refresh between concurrent callers', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    let results: boolean[] = [];
    await act(async () => {
      results = await Promise.all([result.current.refreshToken(), result.current.refreshToken()]);
    });

    expect(results).toEqual([true, true]);
    expect(calls('/api/auth/refresh')).toBe(1);
  });

  it('keeps refreshing before each new expiry, not just once (B3)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setExpiryCookie(Date.now() + HOUR);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(calls('/api/auth/refresh')).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOUR);
    });
    expect(calls('/api/auth/refresh')).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOUR);
    });
    expect(calls('/api/auth/refresh')).toBe(2);
    expect(result.current.isAuthenticated).toBe(true);
  });
});
