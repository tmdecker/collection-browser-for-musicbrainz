// @vitest-environment jsdom
import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PreferencesProvider, usePreferences } from '@/hooks/usePreferences';
import { PREFERENCES_STORAGE_KEY } from '@/utils/preference-migration';

const wrapper = ({ children }: { children: ReactNode }) => <PreferencesProvider>{children}</PreferencesProvider>;

afterEach(() => {
  localStorage.clear();
});

describe('usePreferences', () => {
  it('shares one store between all consumers (B4)', () => {
    let setSort: ReturnType<typeof usePreferences>['setSortOption'] | undefined;
    let updateAuth: ReturnType<typeof usePreferences>['updateAuth'] | undefined;

    const SortControl = () => {
      const prefs = usePreferences();
      setSort = prefs.setSortOption;
      return <span data-testid="sort">{prefs.preferences.display.sortOption}</span>;
    };
    const AuthWriter = () => {
      updateAuth = usePreferences().updateAuth;
      return null;
    };

    render(
      <PreferencesProvider>
        <SortControl />
        <AuthWriter />
      </PreferencesProvider>
    );

    act(() => setSort!('title-asc'));
    // Before: a second copy writing auth info put its stale sort order back
    act(() => updateAuth!({ isAuthenticated: true, username: 'tim', userId: '1' }));

    expect(screen.getByTestId('sort').textContent).toBe('title-asc');
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY)!);
    expect(saved.display.sortOption).toBe('title-asc');
    expect(saved.auth.username).toBe('tim');
  });

  it('clears the collection name when the collection ID changes', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    act(() => result.current.setCollectionName('My albums'));
    act(() => result.current.setCollectionId('27a3c068-3ec5-421a-ad12-599d085fdeb1'));
    expect(result.current.preferences.metadata.collectionName).toBe('');

    act(() => result.current.setCollectionName('My albums'));
    act(() => result.current.setCollectionId('27a3c068-3ec5-421a-ad12-599d085fdeb1'));
    expect(result.current.preferences.metadata.collectionName).toBe('My albums');
  });

  it('applies consecutive streaming toggles without losing one', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    act(() => {
      result.current.setEnabledStreamingServices({ spotify: false });
      result.current.setEnabledStreamingServices({ tidal: false });
    });

    expect(result.current.preferences.streaming.enabledServices.spotify).toBe(false);
    expect(result.current.preferences.streaming.enabledServices.tidal).toBe(false);
  });

  it('throws a clear error outside the provider', () => {
    expect(() => renderHook(() => usePreferences())).toThrow('inside <PreferencesProvider>');
  });
});
