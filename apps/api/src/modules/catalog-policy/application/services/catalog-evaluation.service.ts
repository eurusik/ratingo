/**
 * Catalog Evaluation Service
 *
 * Application service for evaluating media items against catalog policies.
 * Connects the Policy Engine (pure functions) with the database layer.
 *
 * Implements ICatalogPolicyEvaluator port for cross-module usage.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import { eq, inArray, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import {
  DEFAULT_PAGE_SIZE as _DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../../../common/constants';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type IMediaWatchOffersRepository,
  MEDIA_WATCH_OFFERS_REPOSITORY,
  type MediaWatchOfferView,
} from '../../../provider/public';
import {
  EligibilityStatus,
  DEFAULT_EVALUATION_CONTEXT,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';
import { evaluateEligibility, computeRelevance } from '../../domain/policy-engine';
import {
  type ICatalogPolicyEvaluator,
  type EvaluateOneInput,
  type EvaluationResult,
} from '../../domain/ports/catalog-policy-evaluator.port';
import {
  type MediaCatalogEvaluation,
  type PolicyEngineInput,
  type NormalizedOffer,
} from '../../domain/types/policy.types';
import {
  type IMediaCatalogEvaluationRepository,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
} from '../../infrastructure/repositories/media-catalog-evaluation.repository';
import {
  type MediaItemRow,
  mapRowToPolicyEngineInput,
  mapRowsToPolicyEngineInputs,
  POLICY_EVALUATION_SELECT_FIELDS,
} from '../utils/policy-input.mapper';

import { CatalogPolicyService } from './catalog-policy.service';

// Re-export for backward compatibility
export { EvaluationResult } from '../../domain/ports/catalog-policy-evaluator.port';

export interface BatchEvaluationResult {
  processed: number;
  eligible: number;
  ineligible: number;
  pending: number;
  review: number;
  errors: number;
}

/**
 * Options for batch evaluation operations.
 * Supports explicit context for multi-context evaluation.
 */
export interface BatchEvaluationOptions {
  /** Specific policy version to evaluate against (defaults to active policy) */
  policyVersion?: number;
  /** Run ID for tracking and counter aggregation */
  runId?: string;
  /** Evaluation context for multi-context support (defaults to DEFAULT_EVALUATION_CONTEXT) */
  context?: EvaluationContextType;
}

@Injectable()
export class CatalogEvaluationService implements ICatalogPolicyEvaluator {
  private readonly logger = new Logger(CatalogEvaluationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly policyService: CatalogPolicyService,
    @Inject(MEDIA_CATALOG_EVALUATION_REPOSITORY)
    private readonly evaluationRepository: IMediaCatalogEvaluationRepository,
    @Inject(MEDIA_WATCH_OFFERS_REPOSITORY)
    private readonly watchOffersRepository: IMediaWatchOffersRepository,
  ) {}

  /**
   * Evaluates a single media item against the active (or specified) policy.
   * Implements ICatalogPolicyEvaluator.evaluateOne
   *
   * @param input - Evaluation input (object form for port contract)
   * @returns Evaluation result with change detection
   */
  async evaluateOne(input: EvaluateOneInput): Promise<EvaluationResult>;
  /**
   * @deprecated Use object form: evaluateOne({ mediaItemId, policyVersion, runId, context })
   */
  async evaluateOne(
    mediaItemId: string,
    policyVersion?: number,
    runId?: string,
  ): Promise<EvaluationResult>;
  async evaluateOne(
    inputOrMediaItemId: EvaluateOneInput | string,
    policyVersion?: number,
    runId?: string,
  ): Promise<EvaluationResult> {
    // Normalize to object form
    const input: EvaluateOneInput =
      typeof inputOrMediaItemId === 'string'
        ? { mediaItemId: inputOrMediaItemId, policyVersion, runId }
        : inputOrMediaItemId;

    const { mediaItemId, context = DEFAULT_EVALUATION_CONTEXT } = input;
    // Get policy
    const policy = input.policyVersion
      ? await this.policyService.getByVersion(input.policyVersion)
      : await this.policyService.getActiveOrThrow();

    if (!policy) {
      throw new NotFoundException(`Policy version ${input.policyVersion} not found`);
    }

    // Get media item data
    const engineInput = await this.buildPolicyEngineInput(mediaItemId);
    if (!engineInput) {
      throw new NotFoundException(`Media item ${mediaItemId} not found`);
    }

    // Get previous evaluation (if exists) for this context
    const previousEvaluation = await this.evaluationRepository.findByMediaId(mediaItemId, context);

    // Run policy engine with context
    const evalResult = evaluateEligibility(engineInput, policy.policy, { context });
    const relevanceScore = computeRelevance(engineInput, policy.policy);

    // Build evaluation entity
    const evaluation: MediaCatalogEvaluation = {
      mediaItemId,
      status: evalResult.status,
      reasons: evalResult.reasons,
      relevanceScore,
      policyVersion: policy.version,
      breakoutRuleId: evalResult.breakoutRuleId,
      evaluatedAt: new Date(),
      runId: input.runId, // Link to specific run for counter aggregation
      context,
    };

    // Persist (idempotent via UNIQUE constraint on media_item_id + policy_version + context)
    const saved = await this.evaluationRepository.upsert(evaluation);

    // Detect change
    const changed =
      !previousEvaluation ||
      previousEvaluation.status !== saved.status ||
      previousEvaluation.policyVersion !== saved.policyVersion;

    if (changed) {
      this.logger.log(
        `Evaluated ${mediaItemId} [${context}]: ${previousEvaluation?.status || 'NEW'} → ${saved.status} (policy v${policy.version})`,
      );
    }

    return {
      mediaItemId,
      evaluation: saved,
      changed,
    };
  }

  async evaluateOneForContexts(
    input: EvaluateOneInput,
    contexts: EvaluationContextType[],
  ): Promise<void> {
    if (contexts.length === 0) return;

    const { mediaItemId } = input;

    // Get policy once
    const policy = input.policyVersion
      ? await this.policyService.getByVersion(input.policyVersion)
      : await this.policyService.getActiveOrThrow();

    if (!policy) {
      throw new NotFoundException(`Policy version ${input.policyVersion} not found`);
    }

    // Build policy engine input once (includes offers)
    const engineInput = await this.buildPolicyEngineInput(mediaItemId);
    if (!engineInput) {
      throw new NotFoundException(`Media item ${mediaItemId} not found`);
    }

    const relevanceScore = computeRelevance(engineInput, policy.policy);
    const evaluatedAt = new Date();

    const evaluations: MediaCatalogEvaluation[] = [];

    for (const context of contexts) {
      const previousEvaluation = await this.evaluationRepository.findByMediaId(
        mediaItemId,
        context,
      );

      const evalResult = evaluateEligibility(engineInput, policy.policy, { context });

      const changed =
        !previousEvaluation ||
        previousEvaluation.status !== evalResult.status ||
        previousEvaluation.policyVersion !== policy.version;

      if (changed) {
        this.logger.log(
          `Evaluated ${mediaItemId} [${context}]: ${previousEvaluation?.status || 'NEW'} → ${evalResult.status} (policy v${policy.version})`,
        );
      }

      evaluations.push({
        mediaItemId,
        status: evalResult.status,
        reasons: evalResult.reasons,
        relevanceScore,
        policyVersion: policy.version,
        breakoutRuleId: evalResult.breakoutRuleId,
        evaluatedAt,
        runId: input.runId,
        context,
      });
    }

    await this.evaluationRepository.bulkUpsert(evaluations);
  }

  /**
   * Evaluates a batch of media items.
   * Used for re-evaluation jobs.
   *
   * @param mediaItemIds - IDs of media items to evaluate
   * @param options - Batch evaluation options including context, policyVersion, runId
   * @returns Batch evaluation summary
   */
  async evaluateBatch(
    mediaItemIds: string[],
    options?: BatchEvaluationOptions,
  ): Promise<BatchEvaluationResult> {
    if (mediaItemIds.length === 0) {
      return { processed: 0, eligible: 0, ineligible: 0, pending: 0, review: 0, errors: 0 };
    }

    // Extract options with defaults
    const context = options?.context ?? DEFAULT_EVALUATION_CONTEXT;
    const policyVersion = options?.policyVersion;
    const runId = options?.runId;

    this.logger.log(
      `Starting batch evaluation: ${mediaItemIds.length} items, context=${context}, policyVersion=${policyVersion ?? 'active'}`,
    );

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
        // Pass context to policy engine
        const evalResult = evaluateEligibility(input, policy.policy, { context });
        const relevanceScore = computeRelevance(input, policy.policy);

        const evaluation: MediaCatalogEvaluation = {
          mediaItemId: input.mediaItem.id,
          status: evalResult.status,
          reasons: evalResult.reasons,
          relevanceScore,
          policyVersion: policy.version,
          breakoutRuleId: evalResult.breakoutRuleId,
          evaluatedAt: new Date(),
          context, // Use provided context
          runId, // Include runId if provided
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
      `Batch evaluation complete [context=${context}]: ${result.processed} items - ` +
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
    const batchSize = options?.batchSize || MAX_PAGE_SIZE;

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
      const batchResult = await this.evaluateBatch(ids, { policyVersion });

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
      .select(POLICY_EVALUATION_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(eq(schema.mediaItems.id, mediaItemId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    // Fetch normalized offers for this media item
    const offersMap = await this.watchOffersRepository.getOffersForMediaBatch([mediaItemId], {
      includeVariantInfo: true,
    });
    const normalizedOffers = this.mapOffersToNormalized(offersMap.get(mediaItemId) ?? []);

    return mapRowToPolicyEngineInput(result[0] as MediaItemRow, normalizedOffers, this.logger);
  }

  /**
   * Builds PolicyEngineInputs for multiple media items (batch).
   */
  private async buildBatchPolicyEngineInputs(mediaItemIds: string[]): Promise<PolicyEngineInput[]> {
    if (mediaItemIds.length === 0) {
      return [];
    }

    const result = await this.db
      .select(POLICY_EVALUATION_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(inArray(schema.mediaItems.id, mediaItemIds));

    // Fetch normalized offers for all media items in batch
    const offersMap = await this.watchOffersRepository.getOffersForMediaBatch(mediaItemIds, {
      includeVariantInfo: true,
    });

    // Convert MediaWatchOfferView to NormalizedOffer
    const normalizedOffersMap = new Map<string, NormalizedOffer[]>();
    for (const [id, offers] of offersMap) {
      normalizedOffersMap.set(id, this.mapOffersToNormalized(offers));
    }

    return mapRowsToPolicyEngineInputs(result as MediaItemRow[], normalizedOffersMap, this.logger);
  }

  /**
   * Maps MediaWatchOfferView to NormalizedOffer for policy engine.
   */
  private mapOffersToNormalized(offers: MediaWatchOfferView[]): NormalizedOffer[] {
    return offers.map((offer) => ({
      providerId: offer.providerId,
      offerType: offer.offerType,
      distributionChannel: offer.distributionChannel,
      isAdsTier: offer.variantIsAdsTier,
    }));
  }
}
