/**
 * Diff Repository Interface (Port)
 *
 * Domain port for computing policy diff data.
 * Implementation in infrastructure layer.
 */

import { type DiffCounts, type DiffSample, type ReasonBreakdown } from '../types/diff.types';

/** DI token for IDiffRepository */
export const DIFF_REPOSITORY = Symbol('DIFF_REPOSITORY');

/**
 * Repository port for computing policy diff data.
 *
 * Separates data access from diff orchestration logic.
 * Implementation lives in infrastructure layer.
 */
export interface IDiffRepository {
  /**
   * Computes aggregated diff counts using SQL aggregation.
   *
   * Uses FULL OUTER JOIN to handle cases where media items exist in one version but not the other.
   * When baselineVersion is NULL (no active policy), all items from target will be counted as improvements.
   *
   * @param targetVersion - Target policy version
   * @param baselineVersion - Baseline policy version (NULL if no active policy)
   * @returns Aggregated diff counts
   */
  computeDiffCounts(targetVersion: number, baselineVersion: number | null): Promise<DiffCounts>;

  /**
   * Gets sample items for a specific diff type.
   *
   * @param targetVersion - Target policy version
   * @param baselineVersion - Baseline policy version (NULL if no active policy)
   * @param type - Type of diff to sample ('regression' or 'improvement')
   * @param limit - Maximum number of samples to return
   * @returns Array of diff samples sorted by trendingScore DESC
   */
  getDiffSamples(
    targetVersion: number,
    baselineVersion: number | null,
    type: 'regression' | 'improvement',
    limit: number,
  ): Promise<DiffSample[]>;

  /**
   * Computes breakdown of reasons for regressions and improvements.
   *
   * @param targetVersion - Target policy version
   * @param baselineVersion - Baseline policy version (NULL if no active policy)
   * @returns Reason breakdown for regressions and improvements
   */
  computeReasonBreakdown(
    targetVersion: number,
    baselineVersion: number | null,
  ): Promise<ReasonBreakdown>;
}
