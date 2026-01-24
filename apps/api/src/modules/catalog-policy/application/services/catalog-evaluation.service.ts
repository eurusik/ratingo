/**
 * Catalog Evaluation Service
 *
 * Application service for evaluating media items against catalog policies.
 * Connects the Policy Engine (pure functions) with the database layer.
 *
 * Implements ICatalogPolicyEvaluator port for cross-module usage.
 *
 * Note: Batch operations are handled by BatchEvaluationService.
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
import { type MediaCatalogEvaluation } from '../../domain/types/policy.types';

import { CatalogPolicyService } from './catalog-policy.service';

// Re-export for backward compatibility
export { EvaluationResult } from '../../domain/ports/catalog-policy-evaluator.port';

// Re-export batch types from BatchEvaluationService for backward compatibility
export {
  type BatchEvaluationResult,
  type BatchEvaluationOptions,
} from './batch-evaluation.service';

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

  /**
   * Evaluates a single media item against the active (or specified) policy.
   * Implements ICatalogPolicyEvaluator.evaluateOne
   *
   * @param input - Evaluation input with mediaItemId, optional policyVersion, runId, context
   * @returns Evaluation result with change detection
   */
  async evaluateOne(input: EvaluateOneInput): Promise<EvaluationResult> {
    const { mediaItemId, context = DEFAULT_EVALUATION_CONTEXT } = input;

    // Get policy
    const policy = input.policyVersion
      ? await this.policyService.getByVersion(input.policyVersion)
      : await this.policyService.getActiveOrThrow();

    if (!policy) {
      throw new NotFoundException(`Policy version ${input.policyVersion} not found`);
    }

    // Get media item data via repository
    const engineInput = await this.policyInputRepository.findOneForEvaluation(mediaItemId);
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

  /**
   * Evaluates a single media item across multiple contexts.
   * Optimized to fetch data once and evaluate for each context.
   *
   * @param input - Evaluation input with mediaItemId, optional policyVersion, runId
   * @param contexts - Array of contexts to evaluate against
   */
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
    const engineInput = await this.policyInputRepository.findOneForEvaluation(mediaItemId);
    if (!engineInput) {
      throw new NotFoundException(`Media item ${mediaItemId} not found`);
    }

    // Fetch all previous evaluations in single query (N+1 fix)
    const previousEvaluationsMap = await this.evaluationRepository.findByMediaIdForContexts(
      mediaItemId,
      contexts,
    );

    const relevanceScore = computeRelevance(engineInput, policy.policy);
    const evaluatedAt = new Date();

    const evaluations: MediaCatalogEvaluation[] = [];

    for (const context of contexts) {
      const previousEvaluation = previousEvaluationsMap.get(context) ?? null;
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
   * Gets eligibility statistics for a specific context.
   * Used for monitoring trending pipeline effectiveness.
   *
   * @param context - Evaluation context (e.g., 'trending', 'catalog')
   * @returns Eligibility stats with counts by status
   */
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
