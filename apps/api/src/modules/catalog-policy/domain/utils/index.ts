/**
 * Utils barrel file.
 *
 * Re-exports all utility functions from the utils directory.
 */

// Title readability utilities
export { isReadableTitle } from './title-readability';

// Offer filter utilities (for NormalizedOffer - domain types)
export {
  filterByAvailabilityMode,
  filterOffersByRequirements,
  hasAnyProvider,
} from './offer-filter';

// Diff utilities (pure functions for status comparison)
export { isDiffRegression, isDiffImprovement } from './diff.utils';
