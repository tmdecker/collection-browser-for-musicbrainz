/**
 * @ai-file hook
 * @ai-description Auth state management for MusicBrainz OAuth2, shared via AuthProvider
 * @ai-dependencies React hooks, auth types, preferences
 * @ai-features Auth state, auto-refresh, login/logout, profile fetching, httpOnly cookies
 * - One shared instance via AuthProvider (a single refresh timer for the whole app)
 * - Concurrent refresh calls share one in-flight request
 * - Refresh timer is re-scheduled from each new expiry
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

const fetchUserProfile = async (): Promise<MusicBrainzUser | null> => {
  try {
    const response = await fetch('/api/auth/profile');
    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }
    return (await response.json()) as MusicBrainzUser;
  } catch {
    return null;
  }
};

const useAuthStore = (): UseAuthReturn => {
  const { updateAuth } = usePreferences();
  const [authState, setAuthState] = useState<AuthState>(UNAUTHENTICATED);

  // Shared promise so concurrent callers wait for the same refresh instead of getting false
  // (the old guard returned false, which made the startup check give up without a profile)
  const refreshPromiseRef = useRef<Promise<number | null> | null>(null);

  // Refresh access token, resolves to the new expiry or null on failure
  const refreshAccessToken = useCallback((): Promise<number | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refresh = async (): Promise<number | null> => {
      try {
        const response = await fetch('/api/auth/refresh', { method: 'POST' });
        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data: { expires_at: number } = await response.json();

        setAuthState(prev => ({
          ...prev,
          accessToken: 'httponly', // Placeholder - real token is in an httpOnly cookie
          expiresAt: data.expires_at,
          status: 'authenticated',
          error: null,
        }));

        return data.expires_at;
      } catch {
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

        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    };

    refreshPromiseRef.current = refresh();
    return refreshPromiseRef.current;
  }, [updateAuth]);

  const refreshToken = useCallback(
    async (): Promise<boolean> => (await refreshAccessToken()) !== null,
    [refreshAccessToken]
  );

  // Check auth status once on mount
  useEffect(() => {
    let cancelled = false;

    const checkAuthStatus = async () => {
      let expiresAt = getTokenExpiryFromCookie();

      if (!expiresAt) {
        return; // No token, user is not authenticated (initial state)
      }

      // Expired token: refresh first and continue with the new expiry
      if (isTokenExpired(expiresAt)) {
        expiresAt = await refreshAccessToken();
        if (!expiresAt || cancelled) {
          return; // Refresh failed, state already updated
        }
      }

      setAuthState(prev => ({ ...prev, status: 'authenticating' }));
      const userData = await fetchUserProfile();
      if (cancelled) return;

      if (userData) {
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
  }, [refreshAccessToken, updateAuth]);

  // Schedule the next refresh from the current expiry; runs again after every refresh,
  // so a tab left open keeps its session (previously the timer was only set once at mount)
  useEffect(() => {
    if (authState.status !== 'authenticated' || !authState.expiresAt) {
      return;
    }

    const refreshIn = Math.max(authState.expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS, 0);
    const refreshTimer = setTimeout(() => {
      refreshAccessToken();
    }, refreshIn);

    return () => clearTimeout(refreshTimer);
  }, [authState.status, authState.expiresAt, refreshAccessToken]);

  // Login function
  const login = useCallback(() => {
    // Full page navigation to the OAuth API route (it redirects to MusicBrainz), not a client-side route
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/api/auth/login';
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
