/**
 * Offer Filter Utilities
 *
 * Pure functions for filtering normalized offers based on policy requirements.
 * Used by PolicyEngine for provider-based eligibility checks.
 */

import {
  OfferType,
  DistributionChannel,
  AvailabilityMode,
  type NormalizedOffer,
  type BreakoutRule,
} from '../types/policy.types';

/**
 * Filters offers by availability mode.
 *
 * @param offers - Offers to filter
 * @param mode - Availability mode
 * @returns Filtered offers
 */
export function filterByAvailabilityMode(
  offers: NormalizedOffer[],
  mode: AvailabilityMode,
): NormalizedOffer[] {
  switch (mode) {
    case AvailabilityMode.SUBSCRIPTION_ONLY:
      return offers.filter((o) => o.offerType === OfferType.FLATRATE);
    case AvailabilityMode.TRANSACTIONAL_ONLY:
      return offers.filter((o) => o.offerType === OfferType.RENT || o.offerType === OfferType.BUY);
    case AvailabilityMode.ANY:
      return offers;
    default:
      return offers;
  }
}

/**
 * Filters offers based on breakout rule requirements.
 *
 * @param offers - All normalized offers
 * @param requirements - Breakout rule requirements
 * @returns Filtered offers
 */
export function filterOffersByRequirements(
  offers: NormalizedOffer[],
  requirements: BreakoutRule['requirements'],
): NormalizedOffer[] {
  let filtered = offers;

  // Filter by availability mode
  const availabilityMode = requirements.availabilityMode ?? AvailabilityMode.SUBSCRIPTION_ONLY;
  filtered = filterByAvailabilityMode(filtered, availabilityMode);

  // Filter by excludeAdsTiers
  if (requirements.excludeAdsTiers) {
    filtered = filtered.filter((offer) => !offer.isAdsTier);
  }

  // Filter by excludeChannelDistribution (only direct)
  if (requirements.excludeChannelDistribution) {
    filtered = filtered.filter((offer) => offer.distributionChannel === DistributionChannel.DIRECT);
  }

  return filtered;
}

/**
 * Checks if media has any of the required providers.
 * Uses normalized offers with canonical provider IDs.
 *
 * @param offers - Normalized watch offers with canonical provider IDs
 * @param requiredProviders - Canonical provider IDs (e.g., 'netflix', 'disney_plus')
 * @param requirements - Breakout rule requirements for filtering
 * @returns True if any required provider is present (after filtering)
 */
export function hasAnyProvider(
  offers: NormalizedOffer[],
  requiredProviders: string[],
  requirements: BreakoutRule['requirements'],
): boolean {
  if (offers.length === 0) {
    return false;
  }

  // Filter offers based on requirements
  const filteredOffers = filterOffersByRequirements(offers, requirements);

  // Check if any filtered offer matches required providers
  return filteredOffers.some((offer) => requiredProviders.includes(offer.providerId));
}
