// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFilters } from '@/hooks/useFilters';
import { ReleaseGroup } from '@/types/music';

const albums: ReleaseGroup[] = [];

afterEach(() => {
  localStorage.clear();
});

describe('useFilters', () => {
  it('keeps filters per collection: a filter set in one never applies to another', () => {
    const { result, rerender } = renderHook(({ filterKey }) => useFilters(albums, filterKey), {
      initialProps: { filterKey: 'collection:a' },
    });

    act(() => result.current.toggleGenre('shoegaze'));
    expect(result.current.selectedGenres).toEqual(['shoegaze']);

    rerender({ filterKey: 'series:b' });
    expect(result.current.selectedGenres).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);

    rerender({ filterKey: 'collection:a' });
    expect(result.current.selectedGenres).toEqual(['shoegaze']);
  });

  it('remembers filters across visits and drops the old shared filters', () => {
    localStorage.setItem('mb-gui-filters', JSON.stringify({ selectedGenres: ['jazz'] }));
    const first = renderHook(() => useFilters(albums, 'collection:a'));
    expect(first.result.current.selectedGenres).toEqual([]);
    expect(localStorage.getItem('mb-gui-filters')).toBeNull();

    act(() => first.result.current.toggleTag('favourite'));
    first.unmount();

    const second = renderHook(() => useFilters(albums, 'collection:a'));
    expect(second.result.current.selectedTags).toEqual(['favourite']);
  });

  it('stores nothing for a collection without filters', () => {
    const { result } = renderHook(() => useFilters(albums, 'collection:a'));
    act(() => result.current.toggleGenre('jazz'));
    act(() => result.current.clearAllFilters());
    expect(JSON.parse(localStorage.getItem('mb-gui-filters-by-collection') || '{}')).toEqual({});
  });
});
