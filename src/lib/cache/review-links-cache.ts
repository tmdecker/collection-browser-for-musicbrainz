/**
 * @ai-file cache
 * @ai-description Server-side caches for the Reviews tab
 * @ai-dependencies base-cache
 * @ai-features
 * - reviewUrlsCache: review URLs of albums whose cached release group has no url-rels yet, keyed by release group, 30 days
 * - reviewPageCache: status and language of each review page, keyed by URL (set with 90 days, or 1 day after a failure)
 * - Singletons via globalThis for persistence across Next.js module re-evaluations
 */

import { BaseCache } from './base-cache';

const REVIEW_URLS_TTL_SECONDS = 30 * 24 * 60 * 60;
const REVIEW_PAGE_TTL_SECONDS = 90 * 24 * 60 * 60;

export interface ReviewPageInfo {
  /** HTTP status of the page (after redirects); null when it could not be reached */
  status: number | null;
  /** Language the page declares, null when it declares none or could not be read */
  language: string | null;
}

class ReviewUrlsCache extends BaseCache<{ urls: string[] }> {
  constructor() {
    super('review-urls', REVIEW_URLS_TTL_SECONDS);
  }
}

class ReviewPageCache extends BaseCache<ReviewPageInfo> {
  constructor() {
    super('review-pages', REVIEW_PAGE_TTL_SECONDS);
  }
}

const globalForReviews = globalThis as unknown as { reviewUrlsCache?: ReviewUrlsCache; reviewPageCache?: ReviewPageCache };
export const reviewUrlsCache = globalForReviews.reviewUrlsCache ?? (globalForReviews.reviewUrlsCache = new ReviewUrlsCache());
export const reviewPageCache = globalForReviews.reviewPageCache ?? (globalForReviews.reviewPageCache = new ReviewPageCache());
