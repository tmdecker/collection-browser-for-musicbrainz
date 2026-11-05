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

  it('keeps the session and retries with backoff when the refresh fails temporarily', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setExpiryCookie(Date.now() + HOUR);
    let unavailableFor = 2;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/auth/refresh') {
        return unavailableFor-- > 0
          ? new Response(null, { status: 503 })
          : json({ expires_at: Date.now() + HOUR, scope: 'profile' });
      }
      if (url === '/api/auth/profile') return json(user);
      return new Response(null, { status: 404 });
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HOUR - 2 * 60 * 1000); // Refresh runs 2 min before expiry
    });
    expect(calls('/api/auth/refresh')).toBe(1);
    expect(result.current.isAuthenticated).toBe(true);

    // First retry after 30 s, the next one 60 s later
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });
    expect(calls('/api/auth/refresh')).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });
    expect(calls('/api/auth/refresh')).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });
    expect(calls('/api/auth/refresh')).toBe(3);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('keeps authenticating on page load while MusicBrainz is unavailable, then logs in', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setExpiryCookie(Date.now() - HOUR);
    let unavailable = true;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/auth/refresh') {
        return unavailable
          ? new Response(null, { status: 503 })
          : json({ expires_at: Date.now() + HOUR, scope: 'profile' });
      }
      if (url === '/api/auth/profile') return json(user);
      return new Response(null, { status: 404 });
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(calls('/api/auth/refresh')).toBe(1));
    expect(result.current.authState.status).toBe('authenticating');

    unavailable = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });
    await waitFor(() => expect(result.current.user).toEqual(user));
    expect(calls('/api/auth/refresh')).toBe(2);
  });

  it('logs out when the refresh token is rejected', async () => {
    setExpiryCookie(Date.now() - HOUR);
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/auth/refresh' ? new Response(null, { status: 401 }) : json(user)
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.authState.status).toBe('error'));
    expect(result.current.isAuthenticated).toBe(false);
    expect(calls('/api/auth/profile')).toBe(0);
  });

  it('retries the profile when it fails temporarily (502)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setExpiryCookie(Date.now() + HOUR);
    let unavailable = true;
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/auth/profile' && unavailable ? new Response(null, { status: 502 }) : json(user)
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(calls('/api/auth/profile')).toBe(1));
    expect(result.current.authState.status).toBe('authenticating');

    unavailable = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 1000);
    });
    await waitFor(() => expect(result.current.user).toEqual(user));
  });
});
