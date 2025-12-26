/**
 * Catalog Evaluation Service
 *
 * Application service for evaluating media items against catalog policies.
 * Connects the Policy Engine (pure functions) with the database layer.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, inArray, isNull } from 'drizzle-orm';

import { CatalogPolicyService } from './catalog-policy.service';
import {
  IMediaCatalogEvaluationRepository,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
} from '../../infrastructure/repositories/media-catalog-evaluation.repository';
import { evaluateEligibility, computeRelevance } from '../../domain/policy-engine';
import {
  MediaCatalogEvaluation,
  PolicyEngineInput,
  WatchProvidersMap,
} from '../../domain/types/policy.types';
import { EligibilityStatus } from '../../domain/constants/evaluation.constants';

export interface EvaluationResult {
  mediaItemId: string;
  evaluation: MediaCatalogEvaluation;
  changed: boolean;
}

export interface BatchEvaluationResult {
  processed: number;
  eligible: number;
  ineligible: number;
  pending: number;
  review: number;
  errors: number;
}

@Injectable()
export class CatalogEvaluationService {
  private readonly logger = new Logger(CatalogEvaluationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly policyService: CatalogPolicyService,
    @Inject(MEDIA_CATALOG_EVALUATION_REPOSITORY)
    private readonly evaluationRepository: IMediaCatalogEvaluationRepository,
  ) {}

  /**
   * Evaluates a single media item against the active (or specified) policy.
   *
   * @param mediaItemId - ID of the media item to evaluate
   * @param policyVersion - Optional specific policy version (defaults to active)
   * @param runId - Optional run ID for tracking (links evaluation to specific run)
   * @returns Evaluation result with change detection
   */
  async evaluateOne(
    mediaItemId: string,
    policyVersion?: number,
    runId?: string,
  ): Promise<EvaluationResult> {
    // Get policy
    const policy = policyVersion
      ? await this.policyService.getByVersion(policyVersion)
      : await this.policyService.getActiveOrThrow();

    if (!policy) {
      throw new NotFoundException(`Policy version ${policyVersion} not found`);
    }

    // Get media item data
    const input = await this.buildPolicyEngineInput(mediaItemId);
    if (!input) {
      throw new NotFoundException(`Media item ${mediaItemId} not found`);
    }

    // Get previous evaluation (if exists)
    const previousEvaluation = await this.evaluationRepository.findByMediaId(mediaItemId);

    // Run policy engine
    const evalResult = evaluateEligibility(input, policy.policy);
    const relevanceScore = computeRelevance(input, policy.policy);

    // Build evaluation entity
    const evaluation: MediaCatalogEvaluation = {
      mediaItemId,
      status: evalResult.status,
      reasons: evalResult.reasons,
      relevanceScore,
      policyVersion: policy.version,
      breakoutRuleId: evalResult.breakoutRuleId,
      evaluatedAt: new Date(),
      runId, // Link to specific run for counter aggregation
    };

    // Persist (idempotent via UNIQUE constraint on run_id + media_item_id)
    const saved = await this.evaluationRepository.upsert(evaluation);

    // Detect change
    const changed =
      !previousEvaluation ||
      previousEvaluation.status !== saved.status ||
      previousEvaluation.policyVersion !== saved.policyVersion;

    if (changed) {
      this.logger.log(
        `Evaluated ${mediaItemId}: ${previousEvaluation?.status || 'NEW'} → ${saved.status} (policy v${policy.version})`,
      );
    }

    return {
      mediaItemId,
      evaluation: saved,
      changed,
    };
  }

  /**
   * Evaluates a batch of media items.
   * Used for re-evaluation jobs.
   *
   * @param mediaItemIds - IDs of media items to evaluate
   * @param policyVersion - Optional specific policy version (defaults to active)
   * @returns Batch evaluation summary
   */
  async evaluateBatch(
    mediaItemIds: string[],
    policyVersion?: number,
  ): Promise<BatchEvaluationResult> {
    if (mediaItemIds.length === 0) {
      return { processed: 0, eligible: 0, ineligible: 0, pending: 0, review: 0, errors: 0 };
    }

    // Get policy
    const policy = policyVersion
      ? await this.policyService.getByVersion(policyVersion)
      : await this.policyService.getActiveOrThrow();

    if (!policy) {
      throw new NotFoundException(`Policy version ${policyVersion} not found`);
    }

    // Build inputs for all items
    const inputs = await this.buildBatchPolicyEngineInputs(mediaItemIds);

    const result: BatchEvaluationResult = {
      processed: 0,
      eligible: 0,
      ineligible: 0,
      pending: 0,
      review: 0,
      errors: 0,
    };

    const evaluations: MediaCatalogEvaluation[] = [];

    for (const input of inputs) {
      try {
        const evalResult = evaluateEligibility(input, policy.policy);
        const relevanceScore = computeRelevance(input, policy.policy);

        const evaluation: MediaCatalogEvaluation = {
          mediaItemId: input.mediaItem.id,
          status: evalResult.status,
          reasons: evalResult.reasons,
          relevanceScore,
          policyVersion: policy.version,
          breakoutRuleId: evalResult.breakoutRuleId,
          evaluatedAt: new Date(),
        };

        evaluations.push(evaluation);

        // Count by status using constants
        switch (evalResult.status) {
          case EligibilityStatus.ELIGIBLE:
            result.eligible++;
            break;
          case EligibilityStatus.INELIGIBLE:
            result.ineligible++;
            break;
          case EligibilityStatus.PENDING:
            result.pending++;
            break;
          case EligibilityStatus.REVIEW:
            result.review++;
            break;
        }

        result.processed++;
      } catch (error) {
        this.logger.error(`Failed to evaluate ${input.mediaItem.id}`, error);
        result.errors++;
      }
    }

    // Bulk upsert
    if (evaluations.length > 0) {
      await this.evaluationRepository.bulkUpsert(evaluations);
    }

    this.logger.log(
      `Batch evaluated ${result.processed} items: ` +
        `${result.eligible} eligible, ${result.ineligible} ineligible, ` +
        `${result.pending} pending, ${result.review} review, ${result.errors} errors`,
    );

    return result;
  }

  /**
   * Re-evaluates all media items for a policy version.
   * Processes in batches with progress callback.
   *
   * @param policyVersion - Policy version to evaluate against
   * @param options - Batch size and progress callback
   */
  async reEvaluateAll(
    policyVersion: number,
    options?: {
      batchSize?: number;
      onProgress?: (processed: number, total: number) => void;
    },
  ): Promise<BatchEvaluationResult> {
    const batchSize = options?.batchSize || 100;

    // Get total count
    const totalResult = await this.db
      .select({ count: schema.mediaItems.id })
      .from(schema.mediaItems)
      .where(isNull(schema.mediaItems.deletedAt));

    const total = totalResult.length;

    this.logger.log(`Starting re-evaluation of ${total} items for policy v${policyVersion}`);

    const aggregateResult: BatchEvaluationResult = {
      processed: 0,
      eligible: 0,
      ineligible: 0,
      pending: 0,
      review: 0,
      errors: 0,
    };

    let offset = 0;

    while (offset < total) {
      // Get batch of media item IDs
      const batch = await this.db
        .select({ id: schema.mediaItems.id })
        .from(schema.mediaItems)
        .where(isNull(schema.mediaItems.deletedAt))
        .limit(batchSize)
        .offset(offset);

      const ids = batch.map((row) => row.id);

      // Evaluate batch
      const batchResult = await this.evaluateBatch(ids, policyVersion);

      // Aggregate results
      aggregateResult.processed += batchResult.processed;
      aggregateResult.eligible += batchResult.eligible;
      aggregateResult.ineligible += batchResult.ineligible;
      aggregateResult.pending += batchResult.pending;
      aggregateResult.review += batchResult.review;
      aggregateResult.errors += batchResult.errors;

      // Progress callback
      if (options?.onProgress) {
        options.onProgress(aggregateResult.processed, total);
      }

      offset += batchSize;
    }

    this.logger.log(
      `Re-evaluation complete: ${aggregateResult.processed}/${total} items processed`,
    );

    return aggregateResult;
  }

  /**
   * Builds PolicyEngineInput from database for a single media item.
   */
  private async buildPolicyEngineInput(mediaItemId: string): Promise<PolicyEngineInput | null> {
    const result = await this.db
      .select({
        // Media item fields
        id: schema.mediaItems.id,
        originCountries: schema.mediaItems.originCountries,
        originalLanguage: schema.mediaItems.originalLanguage,
        watchProviders: schema.mediaItems.watchProviders,
        // Ratings from media_items (external ratings)
        ratingImdb: schema.mediaItems.ratingImdb,
        ratingMetacritic: schema.mediaItems.ratingMetacritic,
        ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
        ratingTrakt: schema.mediaItems.ratingTrakt,
        voteCountImdb: schema.mediaItems.voteCountImdb,
        voteCountTrakt: schema.mediaItems.voteCountTrakt,
        // Stats from media_stats (computed scores)
        qualityScore: schema.mediaStats.qualityScore,
        popularityScore: schema.mediaStats.popularityScore,
        freshnessScore: schema.mediaStats.freshnessScore,
        ratingoScore: schema.mediaStats.ratingoScore,
      })
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(eq(schema.mediaItems.id, mediaItemId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];

    return {
      mediaItem: {
        id: row.id,
        originCountries: row.originCountries as string[] | null,
        originalLanguage: row.originalLanguage,
        watchProviders: row.watchProviders as WatchProvidersMap | null,
        voteCountImdb: row.voteCountImdb,
        voteCountTrakt: row.voteCountTrakt,
        ratingImdb: row.ratingImdb,
        ratingMetacritic: row.ratingMetacritic,
        ratingRottenTomatoes: row.ratingRottenTomatoes,
        ratingTrakt: row.ratingTrakt,
      },
      stats:
        row.qualityScore !== null
          ? {
              qualityScore: row.qualityScore,
              popularityScore: row.popularityScore,
              freshnessScore: row.freshnessScore,
              ratingoScore: row.ratingoScore,
            }
          : null,
    };
  }

  /**
   * Builds PolicyEngineInputs for multiple media items (batch).
   */
  private async buildBatchPolicyEngineInputs(mediaItemIds: string[]): Promise<PolicyEngineInput[]> {
    if (mediaItemIds.length === 0) {
      return [];
    }

    const result = await this.db
      .select({
        // Media item fields
        id: schema.mediaItems.id,
        originCountries: schema.mediaItems.originCountries,
        originalLanguage: schema.mediaItems.originalLanguage,
        watchProviders: schema.mediaItems.watchProviders,
        // Ratings from media_items (external ratings)
        ratingImdb: schema.mediaItems.ratingImdb,
        ratingMetacritic: schema.mediaItems.ratingMetacritic,
        ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
        ratingTrakt: schema.mediaItems.ratingTrakt,
        voteCountImdb: schema.mediaItems.voteCountImdb,
        voteCountTrakt: schema.mediaItems.voteCountTrakt,
        // Stats from media_stats (computed scores)
        qualityScore: schema.mediaStats.qualityScore,
        popularityScore: schema.mediaStats.popularityScore,
        freshnessScore: schema.mediaStats.freshnessScore,
        ratingoScore: schema.mediaStats.ratingoScore,
      })
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(inArray(schema.mediaItems.id, mediaItemIds));

    return result.map((row) => ({
      mediaItem: {
        id: row.id,
        originCountries: row.originCountries as string[] | null,
        originalLanguage: row.originalLanguage,
        watchProviders: row.watchProviders as WatchProvidersMap | null,
        voteCountImdb: row.voteCountImdb,
        voteCountTrakt: row.voteCountTrakt,
        ratingImdb: row.ratingImdb,
        ratingMetacritic: row.ratingMetacritic,
        ratingRottenTomatoes: row.ratingRottenTomatoes,
        ratingTrakt: row.ratingTrakt,
      },
      stats:
        row.qualityScore !== null
          ? {
              qualityScore: row.qualityScore,
              popularityScore: row.popularityScore,
              freshnessScore: row.freshnessScore,
              ratingoScore: row.ratingoScore,
            }
          : null,
    }));
  }
}
