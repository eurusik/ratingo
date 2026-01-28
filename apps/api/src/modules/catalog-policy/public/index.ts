/**
 * Public API for catalog-policy module.
 *
 * This is the ONLY entry point for other modules to import from catalog-policy.
 * Do NOT import directly from domain/ or application/ folders.
 *
 * @example
 * // Correct
 * import { ContentClass, classifyContent, EligibilityStatus } from '../catalog-policy/public';
 *
 * // Wrong - breaks module boundaries
 * import { ContentClass } from '../catalog-policy/domain/classification.service';
 */

// =============================================================================
// Domain Types
// =============================================================================

export { type ContentClass, classifyContent } from '../domain/classification.service';

// =============================================================================
// Evaluation Constants
// =============================================================================

export {
  EligibilityStatus,
  type EligibilityStatusType,
  EvaluationReason,
  type EvaluationReasonType,
  EvaluationContext,
  type EvaluationContextType,
  DEFAULT_EVALUATION_CONTEXT,
  DEFAULT_POLICY_VERSION,
} from '../domain/constants/evaluation.constants';

// =============================================================================
// Normalized Offer Type (for ingestion integration)
// =============================================================================

export type { NormalizedOffer, NormalizedOfferType } from '../domain/types/policy.types';

// =============================================================================
// Port (for cross-module DI)
// =============================================================================

export {
  type ICatalogPolicyEvaluator,
  CATALOG_POLICY_EVALUATOR,
  type EvaluateOneInput,
  type EvaluationResult,
  type EligibilityStats,
} from '../domain/ports';
