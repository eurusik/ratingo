/**
 * Breakout Rule Evaluator
 *
 * Evaluates media items against breakout rules to determine eligibility override.
 * Breakout rules allow blocked/excluded content to become eligible.
 */

import type { BreakoutRule, PolicyConfig, PolicyEngineInput } from '../types/policy.types';

import {
  matchesExcludeOriginCountries,
  matchesOriginCountries,
  matchesMinImdbVotes,
  matchesMinTraktVotes,
  matchesMinQualityScore,
  matchesProviders,
  matchesRatingsPresent,
} from './requirement-matchers';

/**
 * Checks if media matches a breakout rule's requirements.
 *
 * @param input - Media item data and stats
 * @param rule - Breakout rule to check
 * @returns True if all requirements are met
 */
export function matchesBreakoutRule(input: PolicyEngineInput, rule: BreakoutRule): boolean {
  const { mediaItem, stats } = input;
  const { requirements } = rule;

  // Check excludeOriginCountries (ANY intersection = exclude)
  if (!matchesExcludeOriginCountries(mediaItem, requirements.excludeOriginCountries)) {
    return false;
  }

  // Check originCountries (ANY intersection)
  if (!matchesOriginCountries(mediaItem, requirements.originCountries)) {
    return false;
  }

  // Check minImdbVotes
  if (!matchesMinImdbVotes(mediaItem, requirements.minImdbVotes)) {
    return false;
  }

  // Check minTraktVotes
  if (!matchesMinTraktVotes(mediaItem, requirements.minTraktVotes)) {
    return false;
  }

  // Check minQualityScoreNormalized
  if (!matchesMinQualityScore(stats, requirements.minQualityScoreNormalized)) {
    return false;
  }

  // Check requireAnyOfProviders
  if (!matchesProviders(mediaItem, requirements)) {
    return false;
  }

  // Check requireAnyOfRatingsPresent
  if (!matchesRatingsPresent(mediaItem, requirements.requireAnyOfRatingsPresent)) {
    return false;
  }

  return true;
}

/**
 * Finds the first matching breakout rule by priority (lowest number = highest priority).
 * CatalogPolicyService pre-sorts rules on load, so this sort is typically O(n) on
 * an already-sorted array. Kept defensive for callers that bypass the service.
 *
 * @param input - Media item data and stats
 * @param policy - Policy configuration
 * @returns Matching breakout rule or null
 */
export function findMatchingBreakoutRule(
  input: PolicyEngineInput,
  policy: PolicyConfig,
): BreakoutRule | null {
  const rules = [...policy.breakoutRules].sort((a, b) => a.priority - b.priority);

  for (const rule of rules) {
    if (matchesBreakoutRule(input, rule)) {
      return rule;
    }
  }

  return null;
}
