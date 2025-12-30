/**
 * Contract for evaluating media items against catalog policies.
 * Other modules should inject this port, not the concrete service.
 */

import { EligibilityStatusType, EvaluationReasonType } from '../constants/evaluation.constants';

/** Evaluation context for content display surfaces. */
export type EvaluationContext =
  | 'catalog'
  | 'homepage'
  | 'trending'
  | 'now_playing'
  | 'new_digital'
  | 'search';

/** Input for single media item evaluation. */
export interface EvaluateOneInput {
  mediaItemId: string;
  policyVersion?: number;
  runId?: string;
  context?: EvaluationContext;
}

/** Result of evaluating a single media item. */
export interface EvaluationResult {
  mediaItemId: string;
  evaluation: {
    mediaItemId: string;
    status: EligibilityStatusType;
    reasons: EvaluationReasonType[];
    relevanceScore: number;
    policyVersion: number;
    breakoutRuleId: string | null;
    evaluatedAt: Date;
    runId?: string;
  };
  changed: boolean;
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
}

/** DI token for ICatalogPolicyEvaluator */
export const CATALOG_POLICY_EVALUATOR = Symbol('CATALOG_POLICY_EVALUATOR');
