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
  EvaluationContext,
  EvaluationOptions,
  GlobalRequirements,
} from './types/policy.types';
import { EligibilityStatus } from './constants/evaluation.constants';

/**
 * Default contexts where gate applies when appliesTo not configured.
 * Quality-driven surfaces that require maturity signals.
 */
const DEFAULT_QUALITY_CONTEXTS: EvaluationContext[] = ['catalog', 'homepage', 'trending', 'search'];

/**
 * Determines if global gate should be applied for given context.
 *
 * @param requirements - Global requirements configuration
 * @param context - Evaluation context (defaults to 'catalog')
 * @returns True if gate should be applied
 */
export function shouldApplyGlobalGate(
  requirements: GlobalRequirements | undefined,
  context: EvaluationContext = 'catalog',
): boolean {
  if (!requirements) return false;
  const appliesTo = requirements.appliesTo ?? DEFAULT_QUALITY_CONTEXTS;
  return appliesTo.includes(context);
}

/**
 * Evaluates media eligibility based on policy rules.
 *
 * Evaluation order:
 * 1. Missing data → PENDING
 * 2. Blocked checks
 * 3. Global quality gate (if configured)
 * 4. Breakout rules
 * 5. Neutral checks
 * 6. Allowed checks
 *
 * @param input - Media item data and stats
 * @param policy - Active policy configuration
 * @param options - Optional evaluation options (context)
 * @returns Evaluation result with status, reasons, breakoutRuleId, and optional globalGateDetails
 */
export function evaluateEligibility(
  input: PolicyEngineInput,
  policy: PolicyConfig,
  options?: EvaluationOptions,
): Evaluation {
  const { mediaItem } = input;
  const reasons: EvaluationReason[] = [];
  // Context defaults to 'catalog' for legacy/batch compatibility
  const context = options?.context ?? 'catalog';

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
    // Step 3: Global Quality Gate for blocked content
    // Breakout rules require gate to pass
    if (policy.globalRequirements) {
      const gateResult = checkGlobalRequirements(input, policy.globalRequirements);
      if (!gateResult.passes) {
        // Blocked + gate fail → return BLOCKED reason (not MISSING_GLOBAL_SIGNALS)
        // Breakout not attempted
        return {
          status: EligibilityStatus.INELIGIBLE,
          reasons,
          breakoutRuleId: null,
          globalGateDetails: {
            failedChecks: gateResult.failedChecks as any,
          },
        };
      }
    }

    // Step 4: Check breakout rules (gate passed or not configured)
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

  // Step 5: Global Quality Gate for non-blocked content - NOW CONTEXT AWARE
  if (shouldApplyGlobalGate(policy.globalRequirements, context)) {
    const gateResult = checkGlobalRequirements(input, policy.globalRequirements);
    if (!gateResult.passes) {
      // Contract: reasons = exactly ['MISSING_GLOBAL_SIGNALS']
      // Diagnostics go to globalGateDetails only
      return {
        status: EligibilityStatus.INELIGIBLE,
        reasons: ['MISSING_GLOBAL_SIGNALS'],
        breakoutRuleId: null,
        globalGateDetails: {
          failedChecks: gateResult.failedChecks as any,
        },
      };
    }
  }

  // Step 6: Neutral checks (not in allowed/blocked)
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

  // Step 7: Allowed checks (whitelist)
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
 * A rating is valid if it's non-null and not NaN.
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
    let value: number | null = null;
    switch (rating) {
      case 'imdb':
        value = mediaItem.ratingImdb;
        break;
      case 'metacritic':
        value = mediaItem.ratingMetacritic;
        break;
      case 'rt':
        value = mediaItem.ratingRottenTomatoes;
        break;
      case 'trakt':
        value = mediaItem.ratingTrakt;
        break;
    }
    // Check for non-null and non-NaN values
    if (value !== null && !Number.isNaN(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if media meets global quality requirements.
 * All configured conditions are combined with AND logic.
 *
 * @param input - Media item data and stats
 * @param requirements - Global requirements configuration
 * @returns Object with pass/fail status and failed checks
 */
function checkGlobalRequirements(
  input: PolicyEngineInput,
  requirements: PolicyConfig['globalRequirements'],
): { passes: boolean; failedChecks: string[] } {
  if (!requirements) {
    return { passes: true, failedChecks: [] };
  }

  const failedChecks: string[] = [];
  const { mediaItem } = input;

  // Check minQualityScoreNormalized (null/undefined = fail)
  if (requirements.minQualityScoreNormalized !== undefined) {
    const qualityScore = input.stats?.qualityScore;
    if (
      qualityScore === null ||
      qualityScore === undefined ||
      qualityScore < requirements.minQualityScoreNormalized
    ) {
      failedChecks.push('minQualityScoreNormalized');
    }
  }

  // Check requireAnyOfRatingsPresent (OR logic)
  if (
    requirements.requireAnyOfRatingsPresent &&
    requirements.requireAnyOfRatingsPresent.length > 0
  ) {
    if (!hasAnyRating(mediaItem, requirements.requireAnyOfRatingsPresent)) {
      failedChecks.push('requireAnyOfRatingsPresent');
    }
  }

  // Check minVotesAnyOf (OR logic - passes if ANY source meets threshold)
  if (requirements.minVotesAnyOf) {
    const { sources, min } = requirements.minVotesAnyOf;
    const hasEnoughVotes = sources.some((source) => {
      const votes = source === 'imdb' ? mediaItem.voteCountImdb : mediaItem.voteCountTrakt;
      return votes !== null && votes !== undefined && votes >= min;
    });
    if (!hasEnoughVotes) {
      failedChecks.push('minVotesAnyOf');
    }
  }

  return {
    passes: failedChecks.length === 0,
    failedChecks,
  };
}

/**
 * Computes relevance score (0-100) for homepage ranking.
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
