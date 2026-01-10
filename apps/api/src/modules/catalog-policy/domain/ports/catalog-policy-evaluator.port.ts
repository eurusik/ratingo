/**
 * Contract for evaluating media items against catalog policies.
 * Other modules should inject this port, not the concrete service.
 */

import {
  type EligibilityStatusType,
  type EvaluationContextType,
} from '../constants/evaluation.constants';

/** Input for single media item evaluation. */
export interface EvaluateOneInput {
  mediaItemId: string;
  policyVersion?: number;
  runId?: string;
  context?: EvaluationContextType;
}

/** Result of evaluating a single media item. */
export interface EvaluationResult {
  mediaItemId: string;
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
  changed: boolean;
}

/** Eligibility statistics by status. */
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
   *
   * @param {EvaluateOneInput} input - Evaluation input with mediaItemId and optional parameters
   * @returns {Promise<EvaluationResult>} Evaluation result with status, reasons, and change detection
   */
  evaluateOne(input: EvaluateOneInput): Promise<EvaluationResult>;

  /**
   * Gets eligibility statistics for a specific context.
   * Used for monitoring pipeline effectiveness.
   *
   * @param {EvaluationContextType} context - Evaluation context (e.g., 'trending', 'catalog')
   * @returns {Promise<EligibilityStats>} Counts by eligibility status
   */
  getEligibilityStats(context: EvaluationContextType): Promise<EligibilityStats>;
}

/** DI token for ICatalogPolicyEvaluator */
export const CATALOG_POLICY_EVALUATOR = Symbol('CATALOG_POLICY_EVALUATOR');
