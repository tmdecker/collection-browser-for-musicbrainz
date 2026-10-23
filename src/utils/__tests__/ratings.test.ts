import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractRatingFromApiResponse,
  formatRatingDisplay,
  getRatingDisplay,
  shouldRefreshRating,
} from '@/utils/ratings';
import { Rating } from '@/types/music';
import { album } from './fixtures';

const rating = (overrides: Partial<Rating> = {}): Rating => ({
  average: 4.2,
  count: 10,
  personal: null,
  fetchedAt: Date.now(),
  requiresAuth: true,
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatRatingDisplay', () => {
  it('formats to one decimal', () => {
    expect(formatRatingDisplay(4.25)).toBe('4.3');
    expect(formatRatingDisplay(3)).toBe('3.0');
  });
});

describe('extractRatingFromApiResponse', () => {
  it('reads community and personal ratings', () => {
    const result = extractRatingFromApiResponse({
      rating: { value: 4.5, 'votes-count': 12 },
      'user-rating': { value: 5 },
    });
    expect(result).toMatchObject({ average: 4.5, count: 12, personal: 5, requiresAuth: false });
  });

  it('marks auth as required when no personal rating is returned', () => {
    expect(extractRatingFromApiResponse({ rating: { value: 3, 'votes-count': 1 } })).toMatchObject({
      average: 3,
      personal: null,
      requiresAuth: true,
    });
  });

  it('returns undefined when the response has no rating at all', () => {
    expect(extractRatingFromApiResponse({ rating: { value: null, 'votes-count': 0 } })).toBeUndefined();
    expect(extractRatingFromApiResponse({})).toBeUndefined();
  });
});

describe('shouldRefreshRating', () => {
  it('refreshes missing or expired ratings only', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
    const day = 24 * 60 * 60 * 1000;

    expect(shouldRefreshRating(undefined)).toBe(true);
    expect(shouldRefreshRating(rating({ fetchedAt: Date.now() - 29 * day }))).toBe(false);
    expect(shouldRefreshRating(rating({ fetchedAt: Date.now() - 31 * day }))).toBe(true);
  });
});

describe('getRatingDisplay', () => {
  it('shows the average with its vote count in average mode', () => {
    expect(getRatingDisplay(album({ rating: rating() }), 'average')).toEqual({ stars: 4.2, count: 10, isPersonal: false });
  });

  it('shows only the personal rating in personal mode', () => {
    expect(getRatingDisplay(album({ rating: rating({ personal: 4 }) }), 'personal')).toEqual({ stars: 4, isPersonal: true });
    expect(getRatingDisplay(album({ rating: rating() }), 'personal')).toBeNull();
  });

  it('treats a personal rating of 0 as a rating, not as missing', () => {
    expect(getRatingDisplay(album({ rating: rating({ personal: 0 }) }), 'personal')?.stars).toBe(0);
  });
});
