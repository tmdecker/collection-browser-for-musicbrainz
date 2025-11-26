/**
 * @ai-file hook
 * @ai-description Auth state management hook for MusicBrainz OAuth2
 * @ai-dependencies React hooks, auth types, preferences
 * @ai-features Auth state, auto-refresh, login/logout, profile fetching, httpOnly cookies
 */

import { useState, useEffect, useCallback } from 'react';
import { usePreferences } from './usePreferences';
import { AuthState, AuthStatus, AuthError, MusicBrainzUser } from '@/types/auth';
import { isTokenExpired } from '@/utils/oauth';

interface UseAuthReturn {
  authState: AuthState;
  isAuthenticated: boolean;
  user: MusicBrainzUser | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export const useAuth = (): UseAuthReturn => {
  const { preferences, updateAuth } = usePreferences();

  const [authState, setAuthState] = useState<AuthState>({
    status: 'unauthenticated',
    user: null,
    accessToken: null,
    expiresAt: null,
    error: null,
  });

  // Get token expiry from cookies
  // Note: Access token is now httpOnly and cannot be read by JavaScript (security improvement)
  // We only need the expiry timestamp to determine if we need to refresh
  const getTokenFromCookie = useCallback((): { token: string | null; expiresAt: number | null } => {
    if (typeof document === 'undefined') return { token: null, expiresAt: null };

    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    // Access token is httpOnly, so we can't read it. We use expiry as a proxy for token existence
    const expiresAt = cookies['mb_token_expires_at'] ? parseInt(cookies['mb_token_expires_at']) : null;

    // Return a placeholder token value if we have an expiry (indicates token exists server-side)
    const token = expiresAt ? 'httponly' : null;

    return { token, expiresAt };
  }, []);

  // Fetch user profile
  const fetchUserProfile = useCallback(async (): Promise<MusicBrainzUser | null> => {
    try {
      const response = await fetch('/api/auth/profile');

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const userData: MusicBrainzUser = await response.json();
      return userData;
    } catch (error) {
      return null;
    }
  }, []);

  // Refresh access token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // Update auth state with new token
      setAuthState(prev => ({
        ...prev,
        accessToken: data.access_token,
        expiresAt: data.expires_at,
        status: 'authenticated',
        error: null,
      }));

      return true;
    } catch (error) {
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

      return false;
    }
  }, [updateAuth]);

  // Auto-refresh token if expired
  useEffect(() => {
    const { token, expiresAt } = getTokenFromCookie();

    if (token && expiresAt) {
      if (isTokenExpired(expiresAt)) {
        refreshToken();
      } else {
        // Set up auto-refresh before token expires
        const timeUntilExpiry = expiresAt - Date.now();
        const refreshTime = Math.max(timeUntilExpiry - 60000, 0); // Refresh 1 min before expiry

        const refreshTimer = setTimeout(() => {
          refreshToken();
        }, refreshTime);

        return () => clearTimeout(refreshTimer);
      }
    }
  }, [getTokenFromCookie, refreshToken]);

  // Check auth status on mount and when cookies change
  useEffect(() => {
    const checkAuthStatus = async () => {
      const { token, expiresAt } = getTokenFromCookie();

      if (!token || !expiresAt) {
        // No token, user is not authenticated
        setAuthState({
          status: 'unauthenticated',
          user: null,
          accessToken: null,
          expiresAt: null,
          error: null,
        });
        return;
      }

      // Check if token is expired
      if (isTokenExpired(expiresAt)) {
        // Try to refresh
        const refreshed = await refreshToken();
        if (!refreshed) {
          return; // Refresh failed, state already updated
        }
      }

      // Fetch user profile
      setAuthState(prev => ({ ...prev, status: 'authenticating' }));
      const userData = await fetchUserProfile();

      if (userData) {
        setAuthState({
          status: 'authenticated',
          user: userData,
          accessToken: token,
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
          status: 'error',
          user: null,
          accessToken: null,
          expiresAt: null,
          error: {
            type: 'auth_failed',
            message: 'Failed to fetch user profile',
          },
        });
      }
    };

    checkAuthStatus();
  }, [getTokenFromCookie, refreshToken, fetchUserProfile, updateAuth]); // Re-check when cookies change

  // Login function
  const login = useCallback(() => {
    // Redirect to OAuth login endpoint
    window.location.href = '/api/auth/login';
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      setAuthState({
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        expiresAt: null,
        error: null,
      });

      // Clear auth preferences
      updateAuth({
        isAuthenticated: false,
        username: null,
        userId: null,
      });
    } catch (error) {
      // Silently handle logout errors
    }
  }, [updateAuth]);

  return {
    authState,
    isAuthenticated: authState.status === 'authenticated',
    user: authState.user,
    login,
    logout,
    refreshToken,
  };
};
