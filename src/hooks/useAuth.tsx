/**
 * @ai-file hook
 * @ai-description Auth state management for MusicBrainz OAuth2, shared via AuthProvider
 * @ai-dependencies React hooks, auth types, preferences
 * @ai-features Auth state, auto-refresh, login/logout, profile fetching, httpOnly cookies
 * - One shared instance via AuthProvider (a single refresh timer for the whole app)
 * - Concurrent refresh calls share one in-flight request
 * - Refresh timer is re-scheduled from each new expiry
 * - Only a rejected refresh token (401) logs out; temporary failures retry with backoff
 */

import { createContext, useState, useEffect, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { usePreferences } from './usePreferences';
import { AuthState, MusicBrainzUser } from '@/types/auth';
import { isTokenExpired } from '@/utils/oauth';

interface UseAuthReturn {
  authState: AuthState;
  isAuthenticated: boolean;
  user: MusicBrainzUser | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

// Refresh this long before the token expires (must exceed isTokenExpired's 60 s buffer)
const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000;

// Retry backoff when MusicBrainz is temporarily unreachable (the refresh token is kept)
const RETRY_MIN_MS = 30 * 1000;
const RETRY_MAX_MS = 5 * 60 * 1000;

const UNAUTHENTICATED: AuthState = {
  status: 'unauthenticated',
  user: null,
  accessToken: null,
  expiresAt: null,
  error: null,
};

/**
 * Read token expiry from cookies
 * Note: Access token is httpOnly and cannot be read by JavaScript (security improvement)
 * We only need the expiry timestamp to determine if a token exists and needs a refresh
 */
const getTokenExpiryFromCookie = (): number | null => {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies['mb_token_expires_at'] ? parseInt(cookies['mb_token_expires_at']) : null;
};

// Profile, or why there is none: 'rejected' (no valid access token) or 'temporary' (MusicBrainz unreachable)
const fetchUserProfile = async (): Promise<MusicBrainzUser | 'rejected' | 'temporary'> => {
  try {
    const response = await fetch('/api/auth/profile');
    if (response.status === 401) return 'rejected';
    if (!response.ok) return 'temporary';
    return (await response.json()) as MusicBrainzUser;
  } catch {
    return 'temporary';
  }
};

// New expiry after a refresh, or why it failed: 'rejected' (401, log out) or 'temporary' (keep the session)
type RefreshResult = number | 'rejected' | 'temporary';

const useAuthStore = (): UseAuthReturn => {
  const { updateAuth } = usePreferences();
  const [authState, setAuthState] = useState<AuthState>(UNAUTHENTICATED);

  // Shared promise so concurrent callers wait for the same refresh instead of getting false
  // (the old guard returned false, which made the startup check give up without a profile)
  const refreshPromiseRef = useRef<Promise<RefreshResult> | null>(null);

  // One retry timer for temporary failures, with backoff (30 s doubling to 5 min, reset after a success)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(RETRY_MIN_MS);

  const scheduleRetry = useCallback((retry: () => void) => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(retry, retryDelayRef.current);
    retryDelayRef.current = Math.min(retryDelayRef.current * 2, RETRY_MAX_MS);
  }, []);

  useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    },
    []
  );

  // Refresh access token; only a 401 (refresh token rejected) logs out
  const refreshAccessToken = useCallback((): Promise<RefreshResult> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refresh = async (): Promise<RefreshResult> => {
      let response: Response;
      try {
        response = await fetch('/api/auth/refresh', { method: 'POST' });
      } catch {
        return 'temporary';
      }

      if (response.status === 401) {
        setAuthState(prev => ({
          ...prev,
          status: 'error',
          error: {
            type: 'refresh_failed',
            message: 'Failed to refresh token',
          },
        }));

        // Clear auth preferences
        updateAuth({
          isAuthenticated: false,
          username: null,
          userId: null,
        });

        return 'rejected';
      }

      // 503 from the server (MusicBrainz unreachable) or anything else: keep the session
      if (!response.ok) {
        return 'temporary';
      }

      const data: { expires_at: number } = await response.json();
      retryDelayRef.current = RETRY_MIN_MS;

      setAuthState(prev => ({
        ...prev,
        accessToken: 'httponly', // Placeholder - real token is in an httpOnly cookie
        expiresAt: data.expires_at,
        status: 'authenticated',
        error: null,
      }));

      return data.expires_at;
    };

    refreshPromiseRef.current = refresh().finally(() => {
      refreshPromiseRef.current = null;
    });
    return refreshPromiseRef.current;
  }, [updateAuth]);

  const refreshToken = useCallback(
    async (): Promise<boolean> => typeof (await refreshAccessToken()) === 'number',
    [refreshAccessToken]
  );

  // Check auth status once on mount; temporary failures keep 'authenticating' and retry
  useEffect(() => {
    let cancelled = false;

    const checkAuthStatus = async () => {
      let expiresAt = getTokenExpiryFromCookie();

      if (!expiresAt) {
        return; // No token, user is not authenticated (initial state)
      }

      setAuthState(prev => ({ ...prev, status: 'authenticating' }));

      // Expired token: refresh first and continue with the new expiry
      if (isTokenExpired(expiresAt)) {
        const result = await refreshAccessToken();
        if (cancelled || result === 'rejected') {
          return; // Refresh token rejected, state already updated
        }
        if (result === 'temporary') {
          setAuthState(prev => ({ ...prev, status: 'authenticating' }));
          scheduleRetry(checkAuthStatus);
          return;
        }
        expiresAt = result;
      }

      const userData = await fetchUserProfile();
      if (cancelled) return;

      if (userData === 'temporary') {
        scheduleRetry(checkAuthStatus);
        return;
      }

      if (userData !== 'rejected') {
        retryDelayRef.current = RETRY_MIN_MS;
        setAuthState({
          status: 'authenticated',
          user: userData,
          accessToken: 'httponly',
          expiresAt,
          error: null,
        });

        // Update preferences with user info (for UI display only)
        updateAuth({
          isAuthenticated: true,
          username: userData.name,
          userId: userData.id,
        });
      } else {
        setAuthState({
          ...UNAUTHENTICATED,
          status: 'error',
          error: {
            type: 'auth_failed',
            message: 'Failed to fetch user profile',
          },
        });
      }
    };

    checkAuthStatus();
    return () => {
      cancelled = true;
    };
  }, [refreshAccessToken, scheduleRetry, updateAuth]);

  // Schedule the next refresh from the current expiry; runs again after every refresh,
  // so a tab left open keeps its session (previously the timer was only set once at mount)
  useEffect(() => {
    if (authState.status !== 'authenticated' || !authState.expiresAt) {
      return;
    }

    const refreshWithRetry = async () => {
      if ((await refreshAccessToken()) === 'temporary') {
        scheduleRetry(refreshWithRetry);
      }
    };

    const refreshIn = Math.max(authState.expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS, 0);
    const refreshTimer = setTimeout(refreshWithRetry, refreshIn);

    return () => clearTimeout(refreshTimer);
  }, [authState.status, authState.expiresAt, refreshAccessToken, scheduleRetry]);

  // Login function
  const login = useCallback(() => {
    // Full page navigation to the OAuth API route (it redirects to MusicBrainz), not a client-side route.
    // returnTo brings the user back to this page after logging in
    const returnTo = `${window.location.pathname}${window.location.search}`;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      setAuthState(UNAUTHENTICATED);

      // Clear auth preferences
      updateAuth({
        isAuthenticated: false,
        username: null,
        userId: null,
      });
    } catch {
      // Silently handle logout errors
    }
  }, [updateAuth]);

  return useMemo(
    () => ({
      authState,
      isAuthenticated: authState.status === 'authenticated',
      user: authState.user,
      login,
      logout,
      refreshToken,
    }),
    [authState, login, logout, refreshToken]
  );
};

const AuthContext = createContext<UseAuthReturn | null>(null);

/**
 * Holds the one auth state for the whole app (mounted in the root layout, inside PreferencesProvider)
 * Previously Header and the home page each ran their own copy with their own refresh timer;
 * with rotating refresh tokens the second refresh failed and logged the user out
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const value = useAuthStore();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): UseAuthReturn => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
};
