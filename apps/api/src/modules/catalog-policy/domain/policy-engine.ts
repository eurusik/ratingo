/**
 * Catalog Policy Engine - Pure Functions
 *
 * Core business logic for evaluating media eligibility based on policy rules.
 * All functions are pure (no side effects) for deterministic, testable behavior.
 */

import {
  Evaluation,
  EvaluationReason,
  PolicyConfig,
  PolicyEngineInput,
  BreakoutRule,
} from './types/policy.types';
import { EligibilityStatus } from './constants/evaluation.constants';

/**
 * Evaluates media eligibility based on policy rules.
 *
 * Evaluation order:
 * 1. Missing data → PENDING
 * 2. Blocked checks
 * 3. Breakout rules
 * 4. Neutral checks
 * 5. Allowed checks
 *
 * @param input - Media item data and stats
 * @param policy - Active policy configuration
 * @returns Evaluation result with status, reasons, and breakoutRuleId
 */
export function evaluateEligibility(input: PolicyEngineInput, policy: PolicyConfig): Evaluation {
  const { mediaItem } = input;
  const reasons: EvaluationReason[] = [];

  // Step 1: Missing data checks → PENDING
  if (!mediaItem.originCountries || mediaItem.originCountries.length === 0) {
    reasons.push('MISSING_ORIGIN_COUNTRY');
    return { status: EligibilityStatus.PENDING, reasons, breakoutRuleId: null };
  }

  if (!mediaItem.originalLanguage) {
    reasons.push('MISSING_ORIGINAL_LANGUAGE');
    return { status: EligibilityStatus.PENDING, reasons, breakoutRuleId: null };
  }

  // Step 2: Blocked checks
  const isBlocked = checkBlocked(mediaItem, policy, reasons);

  if (isBlocked) {
    // Step 3: Check breakout rules (by priority)
    const breakoutRule = findMatchingBreakoutRule(input, policy);

    if (breakoutRule) {
      return {
        status: EligibilityStatus.ELIGIBLE,
        reasons: ['BREAKOUT_ALLOWED'],
        breakoutRuleId: breakoutRule.id,
      };
    }

    // Blocked without breakout → INELIGIBLE
    return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
  }

  // Step 4: Neutral checks (not in allowed/blocked)
  const isNeutral = checkNeutral(mediaItem, policy, reasons);

  if (isNeutral) {
    // Neutral content is INELIGIBLE unless eligibilityMode is RELAXED
    if (policy.eligibilityMode === 'RELAXED') {
      // In RELAXED mode, neutral is allowed if at least one dimension is allowed
      const hasAllowedCountry = mediaItem.originCountries.some((c) =>
        policy.allowedCountries.includes(c),
      );
      const hasAllowedLanguage = policy.allowedLanguages.includes(mediaItem.originalLanguage);

      if (hasAllowedCountry || hasAllowedLanguage) {
        reasons.push('ALLOWED_COUNTRY');
        return { status: EligibilityStatus.ELIGIBLE, reasons, breakoutRuleId: null };
      }
    }

    return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
  }

  // Step 5: Allowed checks (whitelist)
  // If we reach here, content is in allowed lists
  reasons.push('ALLOWED_COUNTRY');
  reasons.push('ALLOWED_LANGUAGE');

  return { status: EligibilityStatus.ELIGIBLE, reasons, breakoutRuleId: null };
}

/**
 * Checks if media is blocked by country or language rules.
 *
 * @param mediaItem - Media item data
 * @param policy - Policy configuration
 * @param reasons - Array to accumulate reasons (mutated)
 * @returns True if blocked
 */
function checkBlocked(
  mediaItem: PolicyEngineInput['mediaItem'],
  policy: PolicyConfig,
  reasons: EvaluationReason[],
): boolean {
  let isBlocked = false;

  // Check blocked countries
  const blockedCountries = mediaItem.originCountries!.filter((c) =>
    policy.blockedCountries.includes(c),
  );

  if (blockedCountries.length > 0) {
    if (policy.blockedCountryMode === 'ANY') {
      // ANY mode: any blocked country = blocked
      reasons.push('BLOCKED_COUNTRY');
      isBlocked = true;
    } else {
      // MAJORITY mode with tie-breaker
      const totalCountries = mediaItem.originCountries!.length;

      // Tie-breaker: for 1-2 countries, fallback to ANY
      if (totalCountries <= 2) {
        reasons.push('BLOCKED_COUNTRY');
        isBlocked = true;
      } else {
        // For 3+ countries, use majority rule
        const majority = Math.ceil(totalCountries / 2);
        if (blockedCountries.length >= majority) {
          reasons.push('BLOCKED_COUNTRY');
          isBlocked = true;
        }
      }
    }
  }

  // Check blocked language
  if (policy.blockedLanguages.includes(mediaItem.originalLanguage!)) {
    reasons.push('BLOCKED_LANGUAGE');
    isBlocked = true;
  }

  return isBlocked;
}

/**
 * Checks if media is neutral (not in allowed or blocked lists).
 *
 * @param mediaItem - Media item data
 * @param policy - Policy configuration
 * @param reasons - Array to accumulate reasons (mutated)
 * @returns True if neutral
 */
function checkNeutral(
  mediaItem: PolicyEngineInput['mediaItem'],
  policy: PolicyConfig,
  reasons: EvaluationReason[],
): boolean {
  let isNeutral = false;

  // Check if any country is neutral
  const hasNeutralCountry = mediaItem.originCountries!.some(
    (c) => !policy.allowedCountries.includes(c) && !policy.blockedCountries.includes(c),
  );

  if (hasNeutralCountry) {
    reasons.push('NEUTRAL_COUNTRY');
    isNeutral = true;
  }

  // Check if language is neutral
  const isNeutralLanguage =
    !policy.allowedLanguages.includes(mediaItem.originalLanguage!) &&
    !policy.blockedLanguages.includes(mediaItem.originalLanguage!);

  if (isNeutralLanguage) {
    reasons.push('NEUTRAL_LANGUAGE');
    isNeutral = true;
  }

  return isNeutral;
}

/**
 * Finds the first matching breakout rule by priority.
 *
 * @param input - Media item data and stats
 * @param policy - Policy configuration
 * @returns Matching breakout rule or null
 */
function findMatchingBreakoutRule(
  input: PolicyEngineInput,
  policy: PolicyConfig,
): BreakoutRule | null {
  for (const rule of policy.breakoutRules) {
    if (matchesBreakoutRule(input, rule, policy)) {
      return rule;
    }
  }
  return null;
}

/**
 * Checks if media matches a breakout rule's requirements.
 *
 * @param input - Media item data and stats
 * @param rule - Breakout rule to check
 * @param policy - Policy configuration
 * @returns True if all requirements are met
 */
function matchesBreakoutRule(
  input: PolicyEngineInput,
  rule: BreakoutRule,
  policy: PolicyConfig,
): boolean {
  const { mediaItem } = input;
  const { requirements } = rule;

  // Check minImdbVotes
  if (requirements.minImdbVotes !== undefined) {
    if (!mediaItem.voteCountImdb || mediaItem.voteCountImdb < requirements.minImdbVotes) {
      return false;
    }
  }

  // Check minTraktVotes
  if (requirements.minTraktVotes !== undefined) {
    if (!mediaItem.voteCountTrakt || mediaItem.voteCountTrakt < requirements.minTraktVotes) {
      return false;
    }
  }

  // Check minQualityScoreNormalized
  if (requirements.minQualityScoreNormalized !== undefined) {
    if (
      !input.stats?.qualityScore ||
      input.stats.qualityScore < requirements.minQualityScoreNormalized
    ) {
      return false;
    }
  }

  // Check requireAnyOfProviders
  if (requirements.requireAnyOfProviders && requirements.requireAnyOfProviders.length > 0) {
    if (!hasAnyProvider(mediaItem, requirements.requireAnyOfProviders, policy)) {
      return false;
    }
  }

  // Check requireAnyOfRatingsPresent
  if (
    requirements.requireAnyOfRatingsPresent &&
    requirements.requireAnyOfRatingsPresent.length > 0
  ) {
    if (!hasAnyRating(mediaItem, requirements.requireAnyOfRatingsPresent)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if media has any of the required providers.
 *
 * @param mediaItem - Media item data
 * @param requiredProviders - List of required provider names
 * @param policy - Policy configuration
 * @returns True if any required provider is present
 */
function hasAnyProvider(
  mediaItem: PolicyEngineInput['mediaItem'],
  requiredProviders: string[],
  policy: PolicyConfig,
): boolean {
  if (!mediaItem.watchProviders) {
    return false;
  }

  // Check all regions in watchProviders
  for (const region of Object.keys(mediaItem.watchProviders)) {
    const regionProviders = mediaItem.watchProviders[region];

    // Check all provider types (flatrate, rent, buy, ads, free)
    const allProviders = [
      ...(regionProviders.flatrate || []),
      ...(regionProviders.rent || []),
      ...(regionProviders.buy || []),
      ...(regionProviders.ads || []),
      ...(regionProviders.free || []),
    ];

    // Check if any provider matches
    for (const provider of allProviders) {
      if (requiredProviders.includes(provider.name)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if media has any of the required ratings.
 *
 * @param mediaItem - Media item data
 * @param requiredRatings - List of required rating sources
 * @returns True if any required rating is present
 */
function hasAnyRating(
  mediaItem: PolicyEngineInput['mediaItem'],
  requiredRatings: ('imdb' | 'metacritic' | 'rt' | 'trakt')[],
): boolean {
  for (const rating of requiredRatings) {
    switch (rating) {
      case 'imdb':
        if (mediaItem.ratingImdb !== null) return true;
        break;
      case 'metacritic':
        if (mediaItem.ratingMetacritic !== null) return true;
        break;
      case 'rt':
        if (mediaItem.ratingRottenTomatoes !== null) return true;
        break;
      case 'trakt':
        if (mediaItem.ratingTrakt !== null) return true;
        break;
    }
  }
  return false;
}

/**
 * Computes relevance score (0-100) for homepage ranking.
 *
 * Uses weighted average: quality 40%, popularity 40%, freshness 20%.
 *
 * @param input - Media item data and stats
 * @param policy - Policy configuration
 * @returns Relevance score in range [0, 100]
 */
export function computeRelevance(input: PolicyEngineInput, policy: PolicyConfig): number {
  if (!input.stats) {
    return 0;
  }

  const { qualityScore, popularityScore, freshnessScore } = input.stats;

  // If any score is missing or NaN, use 0
  const quality = qualityScore ?? 0;
  const popularity = popularityScore ?? 0;
  const freshness = freshnessScore ?? 0;

  // Guard against NaN values
  const safeQuality = Number.isNaN(quality) ? 0 : quality;
  const safePopularity = Number.isNaN(popularity) ? 0 : popularity;
  const safeFreshness = Number.isNaN(freshness) ? 0 : freshness;

  // Weighted average: quality 40%, popularity 40%, freshness 20%
  const normalized = safeQuality * 0.4 + safePopularity * 0.4 + safeFreshness * 0.2;

  // Scale to 0-100 and round
  const result = Math.round(normalized * 100);

  // Final guard: ensure result is in valid range
  if (Number.isNaN(result) || result < 0) {
    return 0;
  }
  if (result > 100) {
    return 100;
  }

  return result;
}

/**
 * Returns human-readable descriptions for evaluation reasons.
 *
 * @param reasons - List of evaluation reasons
 * @returns Dictionary of reason descriptions
 */
export function getReasonDescriptions(
  reasons: EvaluationReason[],
): Record<EvaluationReason, string> {
  const descriptions: Record<EvaluationReason, string> = {
    MISSING_ORIGIN_COUNTRY: 'Origin country information is missing',
    MISSING_ORIGINAL_LANGUAGE: 'Original language information is missing',
    BLOCKED_COUNTRY: 'Content is from a blocked country',
    BLOCKED_LANGUAGE: 'Content is in a blocked language',
    NEUTRAL_COUNTRY: 'Content is from a neutral country (not in allowed list)',
    NEUTRAL_LANGUAGE: 'Content is in a neutral language (not in allowed list)',
    MISSING_GLOBAL_SIGNALS: 'Content lacks required global signals (ratings, votes, providers)',
    BREAKOUT_ALLOWED: 'Content meets breakout rule requirements',
    ALLOWED_COUNTRY: 'Content is from an allowed country',
    ALLOWED_LANGUAGE: 'Content is in an allowed language',
    NO_ACTIVE_POLICY: 'No active policy is configured',
  };

  return descriptions;
}
