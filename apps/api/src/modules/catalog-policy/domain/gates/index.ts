/**
 * Gates barrel file.
 *
 * Re-exports all gate functions from the gates directory.
 */

// Data Integrity Gate
export { checkDataIntegrity } from './data-integrity.gate';

// Display Gate
export { checkDisplayGates } from './display.gate';

// Country-Language Gate
export { checkBlocked, checkNeutral, tryRelaxedModeEligibility } from './country-language.gate';

// Global Requirements Gate
export { checkGlobalRequirements, shouldApplyGlobalGate } from './global-requirements.gate';
