/**
 * Public API for catalog-policy module.
 *
 * This is the ONLY entry point for other modules to import from catalog-policy.
 * Do NOT import directly from domain/ or application/ folders.
 *
 * @example
 * // Correct
 * import { classifyContent, EligibilityStatus } from '../catalog-policy/public';
 *
 * // Wrong - breaks module boundaries
 * import { classifyContent } from '../catalog-policy/domain/classification.service';
 */

// =============================================================================
// Domain Types
// =============================================================================

export { classifyContent } from '../domain/classification.service';

// =============================================================================
// Evaluation Constants
// =============================================================================

export {
  EligibilityStatus,
  EvaluationReason,
  EvaluationContext,
  type EvaluationContextType,
  DEFAULT_POLICY_VERSION,
} from '../domain/constants/evaluation.constants';

// =============================================================================
// Port (for cross-module DI)
// =============================================================================

export { type ICatalogPolicyEvaluator, CATALOG_POLICY_EVALUATOR } from '../domain/ports';

export { CATALOG_POLICY_QUEUE } from '../catalog-policy.constants';
