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
} as const;
