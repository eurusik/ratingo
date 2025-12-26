/**
 * Diff Service
 *
 * Computes differences between current active policy and a prepared policy run.
 * Shows what will change in the catalog when the new policy is promoted.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, sql } from 'drizzle-orm';
import {
  ICatalogEvaluationRunRepository,
  CATALOG_EVALUATION_RUN_REPOSITORY,
} from '../../infrastructure/repositories/catalog-evaluation-run.repository';
import {
  ICatalogPolicyRepository,
  CATALOG_POLICY_REPOSITORY,
} from '../../infrastructure/repositories/catalog-policy.repository';
import {
  EligibilityStatus,
  DIFF_STATUS_NONE,
  DIFFABLE_RUN_STATUSES,
  DiffStatus,
} from '../../domain/constants/evaluation.constants';

export interface DiffCounts {
  /** Items that will be removed from catalog (ELIGIBLE → INELIGIBLE) */
  regressions: number;
  /** Items that will be added to catalog (INELIGIBLE → ELIGIBLE) */
  improvements: number;
  /** Items that stay eligible */
  unchanged: number;
  /** Items that were and remain ineligible */
  stillIneligible: number;
}

export interface DiffSample {
  mediaItemId: string;
  title: string | null;
  oldStatus: string;
  newStatus: string;
  trendingScore: number | null;
}

export interface DiffReport {
  runId: string;
  targetPolicyVersion: number;
  currentPolicyVersion: number | null;
  counts: DiffCounts;
  /** Top regressions by trendingScore (items leaving catalog) */
  topRegressions: DiffSample[];
  /** Top improvements by trendingScore (items entering catalog) */
  topImprovements: DiffSample[];
}

/**
 * Checks if a status transition represents a regression (item leaving catalog).
 *
 * A regression occurs when an item was ELIGIBLE and becomes INELIGIBLE, PENDING, or is removed.
 *
 * @param oldStatus - Previous status (or 'none' if item didn't exist)
 * @param newStatus - New status (or 'none' if item was removed)
 * @returns true if this is a regression
 */
export function isDiffRegression(oldStatus: DiffStatus, newStatus: DiffStatus): boolean {
  return (
    oldStatus === EligibilityStatus.ELIGIBLE &&
    (newStatus === EligibilityStatus.INELIGIBLE ||
      newStatus === EligibilityStatus.PENDING ||
      newStatus === DIFF_STATUS_NONE)
  );
}

/**
 * Checks if a status transition represents an improvement (item entering catalog).
 *
 * An improvement occurs when an item was INELIGIBLE, PENDING, or didn't exist
 * and becomes ELIGIBLE.
 *
 * @param oldStatus - Previous status (or 'none' if item didn't exist)
 * @param newStatus - New status (or 'none' if item was removed)
 * @returns true if this is an improvement
 */
export function isDiffImprovement(oldStatus: DiffStatus, newStatus: DiffStatus): boolean {
  return (
    (oldStatus === EligibilityStatus.INELIGIBLE ||
      oldStatus === EligibilityStatus.PENDING ||
      oldStatus === DIFF_STATUS_NONE) &&
    newStatus === EligibilityStatus.ELIGIBLE
  );
}

@Injectable()
export class DiffService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
  ) {}

  /**
   * Computes diff between current active policy and a prepared run.
   *
   * @param runId - Run ID to compute diff for
   * @param sampleSize - Number of top items to return (default: 50)
   * @returns DiffReport with counts and samples
   */
  async computeDiff(runId: string, sampleSize: number = 50): Promise<DiffReport> {
    // 1. Fetch run
    const run = await this.runRepository.findById(runId);
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // 2. Verify run is SUCCESS or PROMOTED (diff only makes sense for completed runs)
    if (!DIFFABLE_RUN_STATUSES.includes(run.status as any)) {
      throw new BadRequestException(
        `Run status is ${run.status}, diff only available for ${DIFFABLE_RUN_STATUSES.join(' or ')} runs`,
      );
    }

    // 3. Get current active policy version
    const activePolicy = await this.policyRepository.findActive();
    const currentPolicyVersion = activePolicy?.version ?? null;

    // 4. Compute aggregated counts using SQL aggregation
    const counts = await this.computeCountsSQL(run.targetPolicyVersion!, currentPolicyVersion);

    // 5. Get sample items
    const topRegressions = await this.getSampleItems(
      run.targetPolicyVersion!,
      currentPolicyVersion,
      'regression',
      sampleSize,
    );

    const topImprovements = await this.getSampleItems(
      run.targetPolicyVersion!,
      currentPolicyVersion,
      'improvement',
      sampleSize,
    );

    return {
      runId,
      targetPolicyVersion: run.targetPolicyVersion!,
      currentPolicyVersion,
      counts,
      topRegressions,
      topImprovements,
    };
  }

  /**
   * Computes aggregated diff counts using SQL aggregation.
   *
   * Uses FULL OUTER JOIN to handle cases where media items exist in one version but not the other
   * (e.g., new items added, old items deleted between evaluations).
   *
   * When currentVersion is NULL (no active policy), old_evals CTE will be empty and all items
   * from new_evals will be counted as improvements (old_status = 'none').
   *
   * @param newVersion - Target policy version
   * @param currentVersion - Current active policy version (NULL if no active policy)
   * @returns Aggregated diff counts
   */
  private async computeCountsSQL(
    newVersion: number,
    currentVersion: number | null,
  ): Promise<DiffCounts> {
    // Handle NULL currentVersion explicitly - WHERE policy_version = NULL returns 0 rows
    // When no current policy exists, we use FALSE to get an empty result set for old_evals
    const currentVersionFilter =
      currentVersion !== null ? sql`policy_version = ${currentVersion}` : sql`FALSE`; // Empty result set when no current policy

    // Note: Uses idx_media_catalog_evaluations_version_item_status index
    const result = await this.db.execute<{
      regressions: string;
      improvements: string;
      unchanged: string;
      still_ineligible: string;
    }>(sql`
      WITH old_evals AS (
        SELECT media_item_id, status 
        FROM media_catalog_evaluations 
        WHERE ${currentVersionFilter}
      ),
      new_evals AS (
        SELECT media_item_id, status 
        FROM media_catalog_evaluations 
        WHERE policy_version = ${newVersion}
      ),
      diff AS (
        SELECT 
          COALESCE(o.status::text, ${DIFF_STATUS_NONE}) as old_status,
          COALESCE(n.status::text, ${DIFF_STATUS_NONE}) as new_status
        FROM old_evals o
        FULL OUTER JOIN new_evals n ON o.media_item_id = n.media_item_id
      )
      SELECT
        COUNT(*) FILTER (WHERE old_status = ${EligibilityStatus.ELIGIBLE} AND new_status IN (${EligibilityStatus.INELIGIBLE}, ${EligibilityStatus.PENDING}, ${DIFF_STATUS_NONE}))::int as regressions,
        COUNT(*) FILTER (WHERE old_status IN (${EligibilityStatus.INELIGIBLE}, ${EligibilityStatus.PENDING}, ${DIFF_STATUS_NONE}) AND new_status = ${EligibilityStatus.ELIGIBLE})::int as improvements,
        COUNT(*) FILTER (WHERE old_status = ${EligibilityStatus.ELIGIBLE} AND new_status = ${EligibilityStatus.ELIGIBLE})::int as unchanged,
        COUNT(*) FILTER (WHERE old_status != ${EligibilityStatus.ELIGIBLE} AND new_status != ${EligibilityStatus.ELIGIBLE})::int as still_ineligible
      FROM diff
    `);

    const row = result[0];
    return {
      regressions: parseInt(row?.regressions ?? '0', 10),
      improvements: parseInt(row?.improvements ?? '0', 10),
      unchanged: parseInt(row?.unchanged ?? '0', 10),
      stillIneligible: parseInt(row?.still_ineligible ?? '0', 10),
    };
  }

  /**
   * Gets sample items for a specific diff type using pagination.
   *
   * @param newVersion - Target policy version
   * @param currentVersion - Current active policy version (NULL if no active policy)
   * @param type - Type of diff to sample ('regression' or 'improvement')
   * @param limit - Maximum number of samples to return
   * @returns Array of diff samples sorted by trendingScore DESC
   */
  private async getSampleItems(
    newVersion: number,
    currentVersion: number | null,
    type: 'regression' | 'improvement',
    limit: number,
  ): Promise<DiffSample[]> {
    // Get old evaluations as a map
    const oldMap = new Map<string, DiffStatus>();
    if (currentVersion !== null) {
      const oldEvals = await this.db
        .select({
          mediaItemId: schema.mediaCatalogEvaluations.mediaItemId,
          status: schema.mediaCatalogEvaluations.status,
        })
        .from(schema.mediaCatalogEvaluations)
        .where(eq(schema.mediaCatalogEvaluations.policyVersion, currentVersion));

      for (const e of oldEvals) {
        oldMap.set(e.mediaItemId, e.status as DiffStatus);
      }
    }

    // Get new evaluations with media item info
    const newEvals = await this.db
      .select({
        mediaItemId: schema.mediaCatalogEvaluations.mediaItemId,
        status: schema.mediaCatalogEvaluations.status,
        title: schema.mediaItems.title,
        trendingScore: schema.mediaItems.trendingScore,
      })
      .from(schema.mediaCatalogEvaluations)
      .leftJoin(
        schema.mediaItems,
        eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
      )
      .where(eq(schema.mediaCatalogEvaluations.policyVersion, newVersion));

    // Filter using helper functions and collect samples
    const samples: DiffSample[] = [];

    for (const newEval of newEvals) {
      const oldStatus: DiffStatus = oldMap.get(newEval.mediaItemId) ?? DIFF_STATUS_NONE;
      const newStatus = newEval.status as DiffStatus;

      const isRegression = isDiffRegression(oldStatus, newStatus);
      const isImprovement = isDiffImprovement(oldStatus, newStatus);

      if ((type === 'regression' && isRegression) || (type === 'improvement' && isImprovement)) {
        samples.push({
          mediaItemId: newEval.mediaItemId,
          title: newEval.title,
          oldStatus,
          newStatus,
          trendingScore: newEval.trendingScore,
        });
      }
    }

    // For regressions, also check items in old but not in new (items that were removed)
    if (type === 'regression' && currentVersion !== null) {
      const processedIds = new Set(newEvals.map((e) => e.mediaItemId));

      for (const [mediaItemId, oldStatus] of oldMap) {
        // Check if this is a regression (item was eligible and is now gone)
        if (!processedIds.has(mediaItemId) && isDiffRegression(oldStatus, DIFF_STATUS_NONE)) {
          // Get media item info
          const mediaInfo = await this.db
            .select({
              title: schema.mediaItems.title,
              trendingScore: schema.mediaItems.trendingScore,
            })
            .from(schema.mediaItems)
            .where(eq(schema.mediaItems.id, mediaItemId))
            .limit(1);

          samples.push({
            mediaItemId,
            title: mediaInfo[0]?.title ?? null,
            oldStatus,
            newStatus: DIFF_STATUS_NONE,
            trendingScore: mediaInfo[0]?.trendingScore ?? null,
          });
        }
      }
    }

    // Sort by trendingScore DESC and limit
    return samples.sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0)).slice(0, limit);
  }
}
