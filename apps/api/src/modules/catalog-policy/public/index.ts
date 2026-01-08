/**
 * Public API for catalog-policy module.
 *
 * This is the ONLY entry point for other modules to import from catalog-policy.
 * Do NOT import directly from domain/ or application/ folders.
 *
 * @example
 * // ✅ Correct
 * import { ContentClass, classifyContent, EligibilityStatus } from '../catalog-policy/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { ContentClass } from '../catalog-policy/domain/classification.service';
 */

// =============================================================================
// Domain Types (Ubiquitous Language)
// =============================================================================

export {
  ContentClass,
  ContentClassValues,
  VALID_CONTENT_CLASSES,
  isValidContentClass,
  classifyContent,
  ClassificationInput,
} from '../domain/classification.service';

// =============================================================================
// Evaluation Constants (Contract Types)
// =============================================================================

export {
  EligibilityStatus,
  EligibilityStatusType,
  EvaluationReason,
  EvaluationReasonType,
  DEFAULT_POLICY_VERSION,
  EvaluationContext,
  EvaluationContextType,
  DEFAULT_EVALUATION_CONTEXT,
  ACTIVE_EVALUATION_CONTEXTS,
} from '../domain/constants/evaluation.constants';

// =============================================================================
// Policy Types (for normalized offers)
// =============================================================================

export type { NormalizedOffer, NormalizedOfferType } from '../domain/types/policy.types';

// =============================================================================
// Ports (for cross-module DI)
// =============================================================================

export {
  ICatalogPolicyEvaluator,
  CATALOG_POLICY_EVALUATOR,
  EvaluateOneInput,
  EvaluationResult,
} from '../domain/ports/catalog-policy-evaluator.port';

// Re-export EvaluationContext type alias for backward compatibility
export type { EvaluationContext as PolicyEvaluationContext } from '../domain/types/policy.types';
