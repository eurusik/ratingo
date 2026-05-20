/**
 * Handles batch and re-evaluation operations for catalog policies.
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
import { type CatalogPolicy, type MediaCatalogEvaluation } from '../../domain/types/policy.types';

import { CatalogPolicyService } from './catalog-policy.service';

export interface BatchEvaluationResult {
  processed: number;
  eligible: number;
  ineligible: number;
  review: number;
  errors: number;
}

export interface BatchEvaluationOptions {
  policyVersion?: number;
  runId?: string;
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

  private async resolvePolicy(policyVersion?: number): Promise<CatalogPolicy> {
    if (policyVersion !== undefined) {
      const policy = await this.policyService.getByVersion(policyVersion);
      if (!policy) {
        throw new NotFoundException(`Policy version ${policyVersion} not found`);
      }
      return policy;
    }
    return this.policyService.getActiveOrThrow();
  }

  async evaluateBatch(
    mediaItemIds: string[],
    options?: BatchEvaluationOptions,
  ): Promise<BatchEvaluationResult> {
    if (mediaItemIds.length === 0) {
      return { processed: 0, eligible: 0, ineligible: 0, review: 0, errors: 0 };
    }

    const context = options?.context ?? DEFAULT_EVALUATION_CONTEXT;
    const runId = options?.runId;

    this.logger.log(
      `Starting batch evaluation: ${mediaItemIds.length} items, context=${context}, policyVersion=${options?.policyVersion ?? 'active'}`,
    );

    const policy = await this.resolvePolicy(options?.policyVersion);
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
        const evalResult = evaluateEligibility(input, policy.policy, { context });
        const relevanceScore = computeRelevance(input, policy.policy);

        evaluations.push({
          mediaItemId: input.mediaItem.id,
          status: evalResult.status,
          reasons: evalResult.reasons,
          relevanceScore,
          policyVersion: policy.version,
          breakoutRuleId: evalResult.breakoutRuleId,
          evaluatedAt: new Date(),
          context,
          runId,
        });

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
      } catch (error) {
        this.logger.error(`Failed to evaluate ${input.mediaItem.id}`, error);
        result.errors++;
      }
    }

    result.processed = evaluations.length;

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

  /** Re-evaluates all media items for a policy version. Processes in batches with progress callback. */
  async reEvaluateAll(
    policyVersion: number,
    options?: {
      batchSize?: number;
      context?: EvaluationContextType;
      runId?: string;
      onProgress?: (processed: number, total: number) => void;
    },
  ): Promise<BatchEvaluationResult> {
    const batchSize = options?.batchSize ?? MAX_PAGE_SIZE;
    const context = options?.context;
    const runId = options?.runId;
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

    while (true) {
      const ids = await this.policyInputRepository.fetchBatchIds({ batchSize, cursor });
      if (ids.length === 0) break;

      const batchResult = await this.evaluateBatch(ids, { policyVersion, context, runId });

      aggregateResult.processed += batchResult.processed;
      aggregateResult.eligible += batchResult.eligible;
      aggregateResult.ineligible += batchResult.ineligible;
      aggregateResult.review += batchResult.review;
      aggregateResult.errors += batchResult.errors;

      options?.onProgress?.(aggregateResult.processed, total);

      cursor = ids[ids.length - 1];
    }

    this.logger.log(
      `Re-evaluation complete: ${aggregateResult.processed}/${total} items processed`,
    );

    return aggregateResult;
  }
}
