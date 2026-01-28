/**
 * Evaluates media items against catalog policies.
 * Batch operations are in BatchEvaluationService.
 */

import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';

import {
  DEFAULT_EVALUATION_CONTEXT,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';
import { evaluateEligibility, computeRelevance } from '../../domain/policy-engine';
import {
  type ICatalogPolicyEvaluator,
  type EvaluateOneInput,
  type EvaluationResult,
  type EligibilityStats,
} from '../../domain/ports/catalog-policy-evaluator.port';
import {
  POLICY_INPUT_REPOSITORY,
  type IPolicyInputRepository,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
  type IMediaCatalogEvaluationRepository,
} from '../../domain/repositories';
import { type CatalogPolicy, type MediaCatalogEvaluation } from '../../domain/types/policy.types';

import { CatalogPolicyService } from './catalog-policy.service';

@Injectable()
export class CatalogEvaluationService implements ICatalogPolicyEvaluator {
  private readonly logger = new Logger(CatalogEvaluationService.name);

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

  async evaluateOne(input: EvaluateOneInput): Promise<EvaluationResult> {
    const { mediaItemId, context = DEFAULT_EVALUATION_CONTEXT } = input;

    const policy = await this.resolvePolicy(input.policyVersion);

    const engineInput = await this.policyInputRepository.findOneForEvaluation(mediaItemId);
    if (!engineInput) {
      throw new NotFoundException(`Media item ${mediaItemId} not found`);
    }

    const previousEvaluation = await this.evaluationRepository.findByMediaId(mediaItemId, context);
    const evalResult = evaluateEligibility(engineInput, policy.policy, { context });
    const relevanceScore = computeRelevance(engineInput, policy.policy);

    const evaluation: MediaCatalogEvaluation = {
      mediaItemId,
      status: evalResult.status,
      reasons: evalResult.reasons,
      relevanceScore,
      policyVersion: policy.version,
      breakoutRuleId: evalResult.breakoutRuleId,
      evaluatedAt: new Date(),
      runId: input.runId, // Links to batch run for counter aggregation
      context,
    };

    // Idempotent via UNIQUE(media_item_id, policy_version, context)
    const saved = await this.evaluationRepository.upsert(evaluation);

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

  /** Evaluates a single media item across multiple contexts. Returns count of changed evaluations. */
  async evaluateOneForContexts(
    input: EvaluateOneInput,
    contexts: EvaluationContextType[],
  ): Promise<number> {
    if (contexts.length === 0) return 0;

    const { mediaItemId } = input;

    const policy = await this.resolvePolicy(input.policyVersion);

    const engineInput = await this.policyInputRepository.findOneForEvaluation(mediaItemId);
    if (!engineInput) {
      throw new NotFoundException(`Media item ${mediaItemId} not found`);
    }

    // Batch fetch to avoid N+1
    const previousEvaluationsMap = await this.evaluationRepository.findByMediaIdForContexts(
      mediaItemId,
      contexts,
    );

    const relevanceScore = computeRelevance(engineInput, policy.policy);
    const evaluatedAt = new Date();

    const evaluations: MediaCatalogEvaluation[] = [];
    let changedCount = 0;

    for (const context of contexts) {
      const previousEvaluation = previousEvaluationsMap.get(context) ?? null;
      const evalResult = evaluateEligibility(engineInput, policy.policy, { context });

      const changed =
        !previousEvaluation ||
        previousEvaluation.status !== evalResult.status ||
        previousEvaluation.policyVersion !== policy.version;

      if (changed) {
        changedCount++;
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

    return changedCount;
  }

  async getEligibilityStats(context: EvaluationContextType): Promise<EligibilityStats> {
    const policy = await this.policyService.getActiveOrThrow();
    const counts = await this.evaluationRepository.countByStatusAndPolicyVersion(
      policy.version,
      context,
    );

    return {
      eligible: counts.eligible,
      ineligible: counts.ineligible,
      review: counts.review,
      total: counts.eligible + counts.ineligible + counts.review,
    };
  }
}
