/**
 * Provider Filter Utilities
 *
 * Pure functions for filtering media watch offers based on breakout rule requirements.
 * Used by PolicyEngine for provider-based eligibility checks.
 */

import type { MediaWatchOfferView } from '../../../provider/public';
import type { AvailabilityMode, BreakoutProviderRequirements } from '../types/policy.types';

/**
 * Filters offers by availability mode.
 *
 * @param offers - List of offers to filter
 * @param mode - Availability mode filter
 * @returns Filtered offers
 */
export function filterByAvailabilityMode(
  offers: MediaWatchOfferView[],
  mode: AvailabilityMode = 'subscription_only',
): MediaWatchOfferView[] {
  switch (mode) {
    case 'subscription_only':
      return offers.filter((o) => o.offerType === 'flatrate');
    case 'transactional_only':
      return offers.filter((o) => o.offerType === 'rent' || o.offerType === 'buy');
    case 'any':
      return offers;
  }
}

/**
 * Filters out ads-tier variants.
 *
 * @param offers - List of offers to filter
 * @returns Offers without ads-tier variants
 */
export function filterOutAdsTiers(offers: MediaWatchOfferView[]): MediaWatchOfferView[] {
  return offers.filter((o) => o.variantIsAdsTier !== true);
}

/**
 * Filters to direct distribution channel only.
 *
 * @param offers - List of offers to filter
 * @returns Offers with direct distribution only
 */
export function filterDirectDistribution(offers: MediaWatchOfferView[]): MediaWatchOfferView[] {
  return offers.filter((o) => o.distributionChannel === 'direct');
}

/**
 * Checks if any offer matches the required providers.
 *
 * @param offers - List of offers to check
 * @param requiredProviders - Canonical provider IDs to match
 * @returns True if any offer matches
 */
export function matchesAnyProvider(
  offers: MediaWatchOfferView[],
  requiredProviders: string[],
): boolean {
  return offers.some((o) => requiredProviders.includes(o.providerId));
}

/**
 * Checks if media has any of the required providers with all filters applied.
 *
 * Filter order:
 * 1. Filter by availabilityMode (subscription_only → flatrate, transactional_only → rent/buy)
 * 2. Filter out ads tiers (if excludeAdsTiers = true)
 * 3. Filter to direct distribution (if excludeChannelDistribution = true)
 * 4. Check if any remaining offer matches requireAnyOfProviders
 *
 * @param offers - Media watch offers for the media item
 * @param requirements - Provider requirements from breakout rule
 * @returns True if any required provider is present after filtering
 */
export function hasRequiredProvider(
  offers: MediaWatchOfferView[],
  requirements: BreakoutProviderRequirements,
): boolean {
  const { requireAnyOfProviders, availabilityMode, excludeAdsTiers, excludeChannelDistribution } =
    requirements;

  // No provider requirement = passes
  if (!requireAnyOfProviders || requireAnyOfProviders.length === 0) {
    return true;
  }

  // No offers = fails
  if (!offers || offers.length === 0) {
    return false;
  }

  let filtered = offers;

  // Step 1: Filter by availability mode (default: subscription_only)
  filtered = filterByAvailabilityMode(filtered, availabilityMode ?? 'subscription_only');

  // Step 2: Filter out ads tiers (if requested)
  if (excludeAdsTiers) {
    filtered = filterOutAdsTiers(filtered);
  }

  // Step 3: Filter to direct distribution (if requested)
  if (excludeChannelDistribution) {
    filtered = filterDirectDistribution(filtered);
  }

  // Step 4: Check if any required provider matches
  return matchesAnyProvider(filtered, requireAnyOfProviders);
}
