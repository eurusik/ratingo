/**
 * Requirement Matchers
 *
 * Individual functions for matching breakout rule requirements.
 * Each matcher is a pure function that returns true if the requirement is met.
 */

import { hasAnyRating } from '../gates/global-requirements.gate';
import type { BreakoutRule, PolicyEngineInput } from '../types/policy.types';
import { hasAnyProvider } from '../utils/offer-filter';

/**
 * Checks excludeOriginCountries requirement.
 * Returns false if any origin country is in the exclude list.
 *
 * @param mediaItem - Media item data
 * @param excludeOriginCountries - Countries to exclude
 * @returns True if no excluded country is present
 */
export function matchesExcludeOriginCountries(
  mediaItem: PolicyEngineInput['mediaItem'],
  excludeOriginCountries: string[] | undefined,
): boolean {
  if (!excludeOriginCountries || excludeOriginCountries.length === 0) {
    return true;
  }

  // Defensive: if origin countries are empty/missing, cannot verify exclusion - fail safe
  if (!mediaItem.originCountries || mediaItem.originCountries.length === 0) {
    return false;
  }

  const hasExcludedCountry = excludeOriginCountries.some((country) =>
    mediaItem.originCountries!.includes(country),
  );

  return !hasExcludedCountry;
}

/**
 * Checks originCountries requirement.
 * Returns true if any origin country matches the required list.
 *
 * @param mediaItem - Media item data
 * @param originCountries - Required origin countries (ANY match)
 * @returns True if at least one required country is present
 */
export function matchesOriginCountries(
  mediaItem: PolicyEngineInput['mediaItem'],
  originCountries: string[] | undefined,
): boolean {
  if (!originCountries || originCountries.length === 0) {
    return true;
  }

  if (!mediaItem.originCountries || mediaItem.originCountries.length === 0) {
    return false;
  }

  return originCountries.some((country) => mediaItem.originCountries!.includes(country));
}

/**
 * Checks minImdbVotes requirement.
 *
 * @param mediaItem - Media item data
 * @param minImdbVotes - Minimum required IMDb votes
 * @returns True if requirement is met
 */
export function matchesMinImdbVotes(
  mediaItem: PolicyEngineInput['mediaItem'],
  minImdbVotes: number | undefined,
): boolean {
  if (minImdbVotes === undefined) {
    return true;
  }

  return mediaItem.voteCountImdb !== null && mediaItem.voteCountImdb >= minImdbVotes;
}

/**
 * Checks minTraktVotes requirement.
 *
 * @param mediaItem - Media item data
 * @param minTraktVotes - Minimum required Trakt votes
 * @returns True if requirement is met
 */
export function matchesMinTraktVotes(
  mediaItem: PolicyEngineInput['mediaItem'],
  minTraktVotes: number | undefined,
): boolean {
  if (minTraktVotes === undefined) {
    return true;
  }

  return mediaItem.voteCountTrakt !== null && mediaItem.voteCountTrakt >= minTraktVotes;
}

/**
 * Checks minQualityScoreNormalized requirement.
 *
 * @param stats - Media stats
 * @param minQualityScoreNormalized - Minimum required quality score
 * @returns True if requirement is met
 */
export function matchesMinQualityScore(
  stats: PolicyEngineInput['stats'],
  minQualityScoreNormalized: number | undefined,
): boolean {
  if (minQualityScoreNormalized === undefined) {
    return true;
  }

  return (
    stats?.qualityScore !== null &&
    stats?.qualityScore !== undefined &&
    stats.qualityScore >= minQualityScoreNormalized
  );
}

/**
 * Checks requireAnyOfProviders requirement.
 *
 * @param mediaItem - Media item data
 * @param requirements - Breakout rule requirements
 * @returns True if any required provider is present
 */
export function matchesProviders(
  mediaItem: PolicyEngineInput['mediaItem'],
  requirements: BreakoutRule['requirements'],
): boolean {
  if (!requirements.requireAnyOfProviders || requirements.requireAnyOfProviders.length === 0) {
    return true;
  }

  return hasAnyProvider(
    mediaItem.normalizedOffers,
    requirements.requireAnyOfProviders,
    requirements,
  );
}

/**
 * Checks requireAnyOfRatingsPresent requirement.
 *
 * @param mediaItem - Media item data
 * @param requiredRatings - List of required rating sources
 * @returns True if any required rating is present
 */
export function matchesRatingsPresent(
  mediaItem: PolicyEngineInput['mediaItem'],
  requiredRatings: BreakoutRule['requirements']['requireAnyOfRatingsPresent'],
): boolean {
  if (!requiredRatings || requiredRatings.length === 0) {
    return true;
  }

  return hasAnyRating(mediaItem, requiredRatings);
}
