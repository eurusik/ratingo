/**
 * Catalog Policy Constants
 *
 * Queue and job type definitions for background processing.
 */

/**
 * Queue name for catalog policy background jobs.
 */
export const CATALOG_POLICY_QUEUE = 'catalog-policy-queue';

/**
 * Job types for the catalog policy queue.
 */
export const CATALOG_POLICY_JOBS = {
  RE_EVALUATE_ALL: 're-evaluate-all',
  EVALUATE_CATALOG_ITEM: 'evaluate-catalog-item',
  WATCHDOG: 'watchdog',
} as const;

/**
 * Trending gate thresholds for public catalog.
 * Content must pass at least one of these to appear in trending.
 */
export const TRENDING_GATE = {
  /** Minimum freshness score (0-100). New content released within ~6 months. */
  MIN_FRESHNESS_SCORE: 50,
  /** Minimum active watchers count. Content being actively watched. */
  MIN_WATCHERS_COUNT: 10,
} as const;

/**
 * Policy status values for presentation layer.
 */
export const PolicyStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type PolicyStatusType = (typeof PolicyStatus)[keyof typeof PolicyStatus];
