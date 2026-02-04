import { eq, gt, isNull, isNotNull, type SQL } from 'drizzle-orm';

import * as schema from '@/database/schema';
import { EligibilityStatus, EvaluationContext } from '@/modules/catalog-policy/public';

/**
 * Options for building snapshot candidate conditions.
 */
export interface SnapshotConditionsOptions {
  /** Active policy version to filter evaluations (integer) */
  policyVersion: number;
  /** Optional cursor for pagination (id > cursor) */
  cursor?: string;
}

/**
 * Builds WHERE conditions for finding eligible snapshot candidates.
 *
 * Selects items that:
 * - Are not soft-deleted
 * - Have a valid TMDB ID
 * - Are ELIGIBLE in TRENDING context for the active policy version
 *
 * Used by snapshots sync to identify items that should have their
 * popularity/watchers data captured for historical tracking.
 *
 * @param options - Filtering options including policy version and optional cursor
 * @returns Array of SQL conditions for WHERE clause
 *
 * @example
 * ```typescript
 * const conditions = buildSnapshotCandidateConditions({
 *   policyVersion: 'v1.0.0',
 *   cursor: 'last-processed-id',
 * });
 * // Use in: .where(and(...conditions))
 * ```
 */
export function buildSnapshotCandidateConditions(options: SnapshotConditionsOptions): SQL[] {
  const { policyVersion, cursor } = options;

  const conditions: SQL[] = [
    isNull(schema.mediaItems.deletedAt),
    isNotNull(schema.mediaItems.tmdbId),
    eq(schema.mediaCatalogEvaluations.policyVersion, policyVersion),
    eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
    eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
  ];

  if (cursor) {
    conditions.push(gt(schema.mediaItems.id, cursor));
  }

  return conditions;
}
