/**
 * Batch Evaluation Service
 *
 * Handles batch and re-evaluation operations for catalog policies.
 * Extracted from CatalogEvaluationService for SRP compliance.
 */

import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';

import { MAX_PAGE_SIZE } from '../../../../common/constants';
import {
  EligibilityStatus,
  DEFAULT_EVALUATION_CONTEXT,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';
import { evaluateEligibility, computeRelevance } from '../../domain/policy-engine';
import {
  POLICY_INPUT_REPOSITORY,
  type IPolicyInputRepository,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
  type IMediaCatalogEvaluationRepository,
} from '../../domain/repositories';
import { type MediaCatalogEvaluation } from '../../domain/types/policy.types';

import { CatalogPolicyService } from './catalog-policy.service';

/**
 * Result of batch evaluation operation.
 */
export interface BatchEvaluationResult {
  processed: number;
  eligible: number;
  ineligible: number;
  review: number;
  errors: number;
}

/**
 * Options for batch evaluation operations.
 */
export interface BatchEvaluationOptions {
  /** Specific policy version to evaluate against (defaults to active policy) */
  policyVersion?: number;
  /** Run ID for tracking and counter aggregation */
  runId?: string;
  /** Evaluation context (defaults to DEFAULT_EVALUATION_CONTEXT) */
  context?: EvaluationContextType;
}

@Injectable()
export class BatchEvaluationService {
  private readonly logger = new Logger(BatchEvaluationService.name);

  constructor(
    @Inject(POLICY_INPUT_REPOSITORY)
    private readonly policyInputRepository: IPolicyInputRepository,
    private readonly policyService: CatalogPolicyService,
    @Inject(MEDIA_CATALOG_EVALUATION_REPOSITORY)
    private readonly evaluationRepository: IMediaCatalogEvaluationRepository,
  ) {}

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
      return { processed: 0, eligible: 0, ineligible: 0, review: 0, errors: 0 };
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

    // Build inputs for all items using repository
    const inputs = await this.policyInputRepository.findManyForEvaluation(mediaItemIds);

    const result: BatchEvaluationResult = {
      processed: 0,
      eligible: 0,
      ineligible: 0,
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

        // Count by status
        switch (evalResult.status) {
          case EligibilityStatus.ELIGIBLE:
            result.eligible++;
            break;
          case EligibilityStatus.INELIGIBLE:
            result.ineligible++;
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
        `${result.review} review, ${result.errors} errors`,
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
    const total = await this.policyInputRepository.countEligibleItems();

    this.logger.log(`Starting re-evaluation of ${total} items for policy v${policyVersion}`);

    const aggregateResult: BatchEvaluationResult = {
      processed: 0,
      eligible: 0,
      ineligible: 0,
      review: 0,
      errors: 0,
    };

    let cursor: string | undefined;

    while (aggregateResult.processed < total) {
      // Get batch of media item IDs using repository
      const ids = await this.policyInputRepository.fetchBatchIds({
        batchSize,
        cursor,
      });

      if (ids.length === 0) {
        break;
      }

      // Evaluate batch
      const batchResult = await this.evaluateBatch(ids, { policyVersion });

      // Aggregate results
      aggregateResult.processed += batchResult.processed;
      aggregateResult.eligible += batchResult.eligible;
      aggregateResult.ineligible += batchResult.ineligible;
      aggregateResult.review += batchResult.review;
      aggregateResult.errors += batchResult.errors;

      // Progress callback
      if (options?.onProgress) {
        options.onProgress(aggregateResult.processed, total);
      }

      // Update cursor to last item in batch
      cursor = ids[ids.length - 1];
    }

    this.logger.log(
      `Re-evaluation complete: ${aggregateResult.processed}/${total} items processed`,
    );

    return aggregateResult;
  }
}
