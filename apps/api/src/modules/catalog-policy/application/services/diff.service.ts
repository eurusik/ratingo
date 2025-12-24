/**
 * Diff Service
 *
 * Computes differences between current active policy and a prepared policy run.
 * Shows what will change in the catalog when the new policy is promoted.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class DiffService {
  private readonly logger = new Logger(DiffService.name);

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

    // 4. Compute aggregated counts
    const counts = await this.computeCounts(run.targetPolicyVersion!, currentPolicyVersion);

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
   * Computes aggregated diff counts.
   */
  private async computeCounts(
    newVersion: number,
    currentVersion: number | null,
  ): Promise<DiffCounts> {
    // If no current policy, everything is "new"
    if (currentVersion === null) {
      const result = await this.db
        .select({
          eligible: sql<number>`COUNT(*) FILTER (WHERE status = 'ELIGIBLE')::int`,
          ineligible: sql<number>`COUNT(*) FILTER (WHERE status = 'INELIGIBLE')::int`,
        })
        .from(schema.mediaCatalogEvaluations)
        .where(eq(schema.mediaCatalogEvaluations.policyVersion, newVersion));

      return {
        regressions: 0,
        improvements: result[0]?.eligible ?? 0,
        unchanged: 0,
        stillIneligible: result[0]?.ineligible ?? 0,
      };
    }

    // Get old evaluations as a map
    const oldEvals = await this.db
      .select({
        mediaItemId: schema.mediaCatalogEvaluations.mediaItemId,
        status: schema.mediaCatalogEvaluations.status,
      })
      .from(schema.mediaCatalogEvaluations)
      .where(eq(schema.mediaCatalogEvaluations.policyVersion, currentVersion));

    const oldMap = new Map(oldEvals.map((e) => [e.mediaItemId, e.status]));

    // Get new evaluations
    const newEvals = await this.db
      .select({
        mediaItemId: schema.mediaCatalogEvaluations.mediaItemId,
        status: schema.mediaCatalogEvaluations.status,
      })
      .from(schema.mediaCatalogEvaluations)
      .where(eq(schema.mediaCatalogEvaluations.policyVersion, newVersion));

    // Compute counts
    let regressions = 0;
    let improvements = 0;
    let unchanged = 0;
    let stillIneligible = 0;

    const processedIds = new Set<string>();

    for (const newEval of newEvals) {
      const oldStatus = oldMap.get(newEval.mediaItemId) ?? DIFF_STATUS_NONE;
      const newStatus = newEval.status;
      processedIds.add(newEval.mediaItemId);

      const isOldEligible = oldStatus === EligibilityStatus.ELIGIBLE;
      const isNewEligible = newStatus === EligibilityStatus.ELIGIBLE;
      const isOldIneligibleOrNone =
        oldStatus === EligibilityStatus.INELIGIBLE ||
        oldStatus === EligibilityStatus.PENDING ||
        oldStatus === DIFF_STATUS_NONE;
      const isNewIneligibleOrPending =
        newStatus === EligibilityStatus.INELIGIBLE || newStatus === EligibilityStatus.PENDING;

      if (isOldEligible && isNewIneligibleOrPending) {
        regressions++;
      } else if (isOldIneligibleOrNone && isNewEligible) {
        improvements++;
      } else if (isOldEligible && isNewEligible) {
        unchanged++;
      } else {
        stillIneligible++;
      }
    }

    // Items in old but not in new (regressions if they were ELIGIBLE)
    for (const [mediaItemId, oldStatus] of oldMap) {
      if (!processedIds.has(mediaItemId)) {
        if (oldStatus === EligibilityStatus.ELIGIBLE) {
          regressions++;
        } else {
          stillIneligible++;
        }
      }
    }

    return { regressions, improvements, unchanged, stillIneligible };
  }

  /**
   * Gets sample items for a specific diff type.
   */
  private async getSampleItems(
    newVersion: number,
    currentVersion: number | null,
    type: 'regression' | 'improvement',
    limit: number,
  ): Promise<DiffSample[]> {
    // Get old evaluations as a map
    const oldMap = new Map<string, string>();
    if (currentVersion !== null) {
      const oldEvals = await this.db
        .select({
          mediaItemId: schema.mediaCatalogEvaluations.mediaItemId,
          status: schema.mediaCatalogEvaluations.status,
        })
        .from(schema.mediaCatalogEvaluations)
        .where(eq(schema.mediaCatalogEvaluations.policyVersion, currentVersion));

      for (const e of oldEvals) {
        oldMap.set(e.mediaItemId, e.status);
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

    // Filter and sort
    const samples: DiffSample[] = [];

    for (const newEval of newEvals) {
      const oldStatus = oldMap.get(newEval.mediaItemId) ?? DIFF_STATUS_NONE;
      const newStatus = newEval.status;

      const isOldEligible = oldStatus === EligibilityStatus.ELIGIBLE;
      const isNewEligible = newStatus === EligibilityStatus.ELIGIBLE;
      const isOldIneligibleOrNone =
        oldStatus === EligibilityStatus.INELIGIBLE ||
        oldStatus === EligibilityStatus.PENDING ||
        oldStatus === DIFF_STATUS_NONE;
      const isNewIneligibleOrPending =
        newStatus === EligibilityStatus.INELIGIBLE || newStatus === EligibilityStatus.PENDING;

      const isRegression = isOldEligible && isNewIneligibleOrPending;
      const isImprovement = isOldIneligibleOrNone && isNewEligible;

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

    // For regressions, also check items in old but not in new
    if (type === 'regression' && currentVersion !== null) {
      const processedIds = new Set(newEvals.map((e) => e.mediaItemId));

      for (const [mediaItemId, oldStatus] of oldMap) {
        if (!processedIds.has(mediaItemId) && oldStatus === EligibilityStatus.ELIGIBLE) {
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
