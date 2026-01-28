/**
 * Catalog Policy Evaluator Port
 *
 * Contract for evaluating media items against catalog policies.
 * Other modules inject this port, not the concrete service.
 */

import {
  type EligibilityStatusType,
  type EvaluationContextType,
} from '../constants/evaluation.constants';

/**
 * Input for single media item evaluation.
 */
export interface EvaluateOneInput {
  /** Media item ID to evaluate. */
  mediaItemId: string;
  /** Policy version to use. Defaults to active policy. */
  policyVersion?: number;
  /** Run ID to link evaluation to a batch run. */
  runId?: string;
  /** Evaluation context. Defaults to 'catalog'. */
  context?: EvaluationContextType;
}

/**
 * Result of evaluating a single media item.
 *
 * Note: `evaluation` shape matches persisted MediaCatalogEvaluation entity.
 */
export interface EvaluationResult {
  /** Media item ID (convenience accessor). */
  mediaItemId: string;
  /** Persisted evaluation entity. */
  evaluation: {
    mediaItemId: string;
    status: EligibilityStatusType;
    reasons: string[];
    relevanceScore: number;
    policyVersion: number;
    breakoutRuleId: string | null;
    evaluatedAt: Date;
    runId?: string;
  };
  /** True if status or policy version changed from previous evaluation. */
  changed: boolean;
}

/**
 * Eligibility statistics by status.
 */
export interface EligibilityStats {
  eligible: number;
  ineligible: number;
  review: number;
  total: number;
}

/**
 * Port for catalog policy evaluation.
 *
 * @example
 * constructor(
 *   @Inject(CATALOG_POLICY_EVALUATOR)
 *   private readonly evaluator: ICatalogPolicyEvaluator,
 * ) {}
 */
export interface ICatalogPolicyEvaluator {
  /**
   * Evaluates a single media item against the active (or specified) policy.
   */
  evaluateOne(input: EvaluateOneInput): Promise<EvaluationResult>;

  /**
   * Gets eligibility statistics for a specific context.
   * Used for monitoring pipeline effectiveness.
   */
  getEligibilityStats(context: EvaluationContextType): Promise<EligibilityStats>;
}

/** DI token for ICatalogPolicyEvaluator. */
export const CATALOG_POLICY_EVALUATOR = Symbol('CATALOG_POLICY_EVALUATOR');
