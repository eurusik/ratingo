/**
 * Gates barrel file.
 *
 * Re-exports all gate functions from the gates directory.
 */

// Data Integrity Gate
export { checkDataIntegrity, type DataIntegrityResult } from './data-integrity.gate';

// Display Gate
export {
  checkDisplayGates,
  getContextRequirements,
  getDefaultContextRequirements,
  type DisplayGateResult,
} from './display.gate';

// Country-Language Gate
export {
  checkBlocked,
  checkNeutral,
  tryRelaxedModeEligibility,
  type BlockedCheckResult,
  type NeutralCheckResult,
} from './country-language.gate';

// Global Requirements Gate
export {
  checkGlobalRequirements,
  hasAnyRating,
  shouldApplyGlobalGate,
  type GlobalGateFailedCheck,
  type GlobalRequirementsResult,
} from './global-requirements.gate';
