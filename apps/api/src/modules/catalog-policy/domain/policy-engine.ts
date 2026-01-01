/**
 * Catalog Policy Engine - Pure Functions
 *
 * Core business logic for evaluating media eligibility based on policy rules.
 * All functions are pure (no side effects) for deterministic, testable behavior.
 */

import { type ContentClass } from './classification.service';
import {
  EligibilityStatus,
  EvaluationReason,
  type EvaluationReasonType,
} from './constants/evaluation.constants';
import { resolveCanonicalProvider } from './constants/provider-mapping';
import {
  type Evaluation,
  type PolicyConfig,
  type PolicyEngineInput,
  type BreakoutRule,
  type EvaluationContext,
  type EvaluationOptions,
  type GlobalRequirements,
} from './types/policy.types';

/**
 * Default contexts where gate applies when appliesTo not configured.
 * Quality-driven surfaces that require maturity signals.
 */
const DEFAULT_QUALITY_CONTEXTS: EvaluationContext[] = ['catalog', 'homepage', 'trending', 'search'];

/**
 * Checks if content class is excluded by policy.
 *
 * @param contentClass - Media item's content class
 * @param excludedClasses - List of excluded content classes from policy
 * @returns True if content class is excluded
 */
export function checkContentClassExcluded(
  contentClass: ContentClass,
  excludedClasses: ContentClass[] | undefined,
): boolean {
  if (!excludedClasses || excludedClasses.length === 0) {
    return false;
  }
  return excludedClasses.includes(contentClass);
}

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
 * 2. Content class exclusion (SOFT filter - breakout can override)
 * 3. Blocked checks (HARD filter - breakout cannot override)
 * 4. Global quality gate (if configured)
 * 5. Breakout rules
 * 6. Neutral checks
 * 7. Allowed checks
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
  const reasons: EvaluationReasonType[] = [];
  // Context defaults to 'catalog' for legacy/batch compatibility
  const context = options?.context ?? 'catalog';

  // Step 1: Missing data checks → PENDING
  if (!mediaItem.originCountries || mediaItem.originCountries.length === 0) {
    reasons.push(EvaluationReason.MISSING_ORIGIN_COUNTRY);
    return { status: EligibilityStatus.PENDING, reasons, breakoutRuleId: null };
  }

  if (!mediaItem.originalLanguage) {
    reasons.push(EvaluationReason.MISSING_ORIGINAL_LANGUAGE);
    return { status: EligibilityStatus.PENDING, reasons, breakoutRuleId: null };
  }

  // Step 2: Content class exclusion check (SOFT filter)
  const isContentClassExcluded = checkContentClassExcluded(
    mediaItem.contentClass,
    policy.excludedContentClasses,
  );

  // Step 3: Blocked checks (HARD filter)
  const isBlocked = checkBlocked(mediaItem, policy, reasons);

  // Handle excluded content class with breakout opportunity
  if (isContentClassExcluded) {
    // Check if breakout can override the exclusion
    // Global gate must pass first (if configured)
    if (policy.globalRequirements) {
      const gateResult = checkGlobalRequirements(input, policy.globalRequirements);
      if (!gateResult.passes) {
        // Excluded + gate fail → INELIGIBLE
        return {
          status: EligibilityStatus.INELIGIBLE,
          reasons: [EvaluationReason.EXCLUDED_CONTENT_CLASS],
          breakoutRuleId: null,
          globalGateDetails: {
            failedChecks: gateResult.failedChecks,
          },
        };
      }
    }

    // Check breakout rules
    const breakoutRule = findMatchingBreakoutRule(input, policy);

    if (breakoutRule) {
      // Breakout passes - but still need to check hard blocks
      if (isBlocked) {
        // Excluded + breakout + blocked → INELIGIBLE (hard block wins)
        // Include both EXCLUDED_CONTENT_CLASS and BLOCKED_* reasons
        reasons.unshift(EvaluationReason.EXCLUDED_CONTENT_CLASS);
        return {
          status: EligibilityStatus.INELIGIBLE,
          reasons,
          breakoutRuleId: null,
        };
      }

      // Excluded + breakout + not blocked → ELIGIBLE
      return {
        status: EligibilityStatus.ELIGIBLE,
        reasons: [EvaluationReason.EXCLUDED_CONTENT_CLASS, EvaluationReason.BREAKOUT_ALLOWED],
        breakoutRuleId: breakoutRule.id,
      };
    }

    // Excluded without breakout → INELIGIBLE
    return {
      status: EligibilityStatus.INELIGIBLE,
      reasons: [EvaluationReason.EXCLUDED_CONTENT_CLASS],
      breakoutRuleId: null,
    };
  }

  // Non-excluded content continues with normal flow
  if (isBlocked) {
    // Step 4: Global Quality Gate for blocked content
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
            failedChecks: gateResult.failedChecks,
          },
        };
      }
    }

    // Step 5: Check breakout rules (gate passed or not configured)
    const breakoutRule = findMatchingBreakoutRule(input, policy);

    if (breakoutRule) {
      return {
        status: EligibilityStatus.ELIGIBLE,
        reasons: [EvaluationReason.BREAKOUT_ALLOWED],
        breakoutRuleId: breakoutRule.id,
      };
    }

    // Blocked without breakout → INELIGIBLE
    return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
  }

  // Step 6: Global Quality Gate for non-blocked content - NOW CONTEXT AWARE
  if (shouldApplyGlobalGate(policy.globalRequirements, context)) {
    const gateResult = checkGlobalRequirements(input, policy.globalRequirements);
    if (!gateResult.passes) {
      // Contract: reasons = exactly ['MISSING_GLOBAL_SIGNALS']
      // Diagnostics go to globalGateDetails only
      return {
        status: EligibilityStatus.INELIGIBLE,
        reasons: [EvaluationReason.MISSING_GLOBAL_SIGNALS],
        breakoutRuleId: null,
        globalGateDetails: {
          failedChecks: gateResult.failedChecks,
        },
      };
    }
  }

  // Step 7: Neutral checks (not in allowed/blocked)
  const isNeutral = checkNeutral(mediaItem, policy, reasons);

  if (isNeutral) {
    // Neutral content is INELIGIBLE unless eligibilityMode is RELAXED
    const relaxedResult = tryRelaxedModeEligibility(mediaItem, policy);
    if (relaxedResult) return relaxedResult;

    return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
  }

  // Step 8: Allowed checks (whitelist)
  // If we reach here, content is in allowed lists
  reasons.push(EvaluationReason.ALLOWED_COUNTRY);
  reasons.push(EvaluationReason.ALLOWED_LANGUAGE);

  return { status: EligibilityStatus.ELIGIBLE, reasons, breakoutRuleId: null };
}

/**
 * Checks if neutral content can be eligible under RELAXED mode.
 * Returns evaluation result if eligible, null otherwise.
 */
function tryRelaxedModeEligibility(
  mediaItem: PolicyEngineInput['mediaItem'],
  policy: PolicyConfig,
): Evaluation | null {
  if (policy.eligibilityMode !== 'RELAXED') return null;

  // In RELAXED mode, neutral is allowed if at least one dimension is allowed
  const hasAllowedCountry = mediaItem.originCountries!.some((c) =>
    policy.allowedCountries.includes(c),
  );
  const hasAllowedLanguage = policy.allowedLanguages.includes(mediaItem.originalLanguage!);

  if (!hasAllowedCountry && !hasAllowedLanguage) return null;

  // Build allowed reasons for accurate audit trail
  const allowedReasons: EvaluationReasonType[] = [];
  if (hasAllowedCountry) allowedReasons.push(EvaluationReason.ALLOWED_COUNTRY);
  if (hasAllowedLanguage) allowedReasons.push(EvaluationReason.ALLOWED_LANGUAGE);

  return {
    status: EligibilityStatus.ELIGIBLE,
    reasons: allowedReasons,
    breakoutRuleId: null,
  };
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
  reasons: EvaluationReasonType[],
): boolean {
  let isBlocked = false;

  // Check blocked countries
  const blockedCountries = mediaItem.originCountries!.filter((c) =>
    policy.blockedCountries.includes(c),
  );

  if (blockedCountries.length > 0) {
    const isCountryBlocked = isBlockedByCountryRule(
      blockedCountries.length,
      mediaItem.originCountries!.length,
      policy.blockedCountryMode,
    );

    if (isCountryBlocked) {
      reasons.push(EvaluationReason.BLOCKED_COUNTRY);
      isBlocked = true;
    }
  }

  // Check blocked language
  if (policy.blockedLanguages.includes(mediaItem.originalLanguage!)) {
    reasons.push(EvaluationReason.BLOCKED_LANGUAGE);
    isBlocked = true;
  }

  return isBlocked;
}

/**
 * Determines if content is blocked based on country blocking mode.
 */
function isBlockedByCountryRule(
  blockedCount: number,
  totalCountries: number,
  mode: 'ANY' | 'MAJORITY',
): boolean {
  // ANY mode: any blocked country = blocked
  if (mode === 'ANY') return true;

  // MAJORITY mode with tie-breaker: for 1-2 countries, fallback to ANY
  if (totalCountries <= 2) return true;

  // For 3+ countries, use majority rule
  const majority = Math.ceil(totalCountries / 2);
  return blockedCount >= majority;
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
  reasons: EvaluationReasonType[],
): boolean {
  let isNeutral = false;

  // Check if any country is neutral
  const hasNeutralCountry = mediaItem.originCountries!.some(
    (c) => !policy.allowedCountries.includes(c) && !policy.blockedCountries.includes(c),
  );

  if (hasNeutralCountry) {
    reasons.push(EvaluationReason.NEUTRAL_COUNTRY);
    isNeutral = true;
  }

  // Check if language is neutral
  const isNeutralLanguage =
    !policy.allowedLanguages.includes(mediaItem.originalLanguage!) &&
    !policy.blockedLanguages.includes(mediaItem.originalLanguage!);

  if (isNeutralLanguage) {
    reasons.push(EvaluationReason.NEUTRAL_LANGUAGE);
    isNeutral = true;
  }

  return isNeutral;
}

/**
 * Finds the first matching breakout rule by priority.
 * Rules are sorted by priority (lowest number = highest priority) before evaluation.
 *
 * @param input - Media item data and stats
 * @param policy - Policy configuration
 * @returns Matching breakout rule or null
 */
function findMatchingBreakoutRule(
  input: PolicyEngineInput,
  policy: PolicyConfig,
): BreakoutRule | null {
  // Defensive sort: ensure priority order regardless of input array order
  const sortedRules = [...policy.breakoutRules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
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
 * @param mediaItem - Media item with watchProviders
 * @param requiredProviders - Canonical provider IDs (e.g., 'netflix', 'hbo_max')
 * @param policy - Policy configuration
 * @returns True if any required provider is present
 */
function hasAnyProvider(
  mediaItem: PolicyEngineInput['mediaItem'],
  requiredProviders: string[],
  _policy: PolicyConfig,
): boolean {
  if (!mediaItem.watchProviders) {
    return false;
  }

  for (const region of Object.keys(mediaItem.watchProviders)) {
    const regionProviders = mediaItem.watchProviders[region];

    const allProviders = [
      ...(regionProviders.flatrate || []),
      ...(regionProviders.rent || []),
      ...(regionProviders.buy || []),
      ...(regionProviders.ads || []),
      ...(regionProviders.free || []),
    ];

    for (const provider of allProviders) {
      const canonical = resolveCanonicalProvider(provider.providerId);
      if (canonical && requiredProviders.includes(canonical)) {
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

/** Valid failed check types for global gate */
type GlobalGateFailedCheck =
  | 'minQualityScoreNormalized'
  | 'requireAnyOfRatingsPresent'
  | 'minVotesAnyOf';

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
): { passes: boolean; failedChecks: GlobalGateFailedCheck[] } {
  if (!requirements) {
    return { passes: true, failedChecks: [] };
  }

  const failedChecks: GlobalGateFailedCheck[] = [];
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
export function computeRelevance(input: PolicyEngineInput, _policy: PolicyConfig): number {
  // Relevance weights
  const QUALITY_WEIGHT = 0.4;
  const POPULARITY_WEIGHT = 0.4;
  const FRESHNESS_WEIGHT = 0.2;
  const MAX_SCORE = 100;

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
  const normalized =
    safeQuality * QUALITY_WEIGHT +
    safePopularity * POPULARITY_WEIGHT +
    safeFreshness * FRESHNESS_WEIGHT;

  // Scale to 0-100 and round
  const result = Math.round(normalized * MAX_SCORE);

  // Final guard: ensure result is in valid range
  if (Number.isNaN(result) || result < 0) {
    return 0;
  }
  if (result > MAX_SCORE) {
    return MAX_SCORE;
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
  _reasons: EvaluationReasonType[],
): Record<EvaluationReasonType, string> {
  const descriptions: Record<EvaluationReasonType, string> = {
    [EvaluationReason.MISSING_ORIGIN_COUNTRY]: 'Origin country information is missing',
    [EvaluationReason.MISSING_ORIGINAL_LANGUAGE]: 'Original language information is missing',
    [EvaluationReason.BLOCKED_COUNTRY]: 'Content is from a blocked country',
    [EvaluationReason.BLOCKED_LANGUAGE]: 'Content is in a blocked language',
    [EvaluationReason.NEUTRAL_COUNTRY]: 'Content is from a neutral country (not in allowed list)',
    [EvaluationReason.NEUTRAL_LANGUAGE]: 'Content is in a neutral language (not in allowed list)',
    [EvaluationReason.MISSING_GLOBAL_SIGNALS]:
      'Content lacks required global signals (ratings, votes, providers)',
    [EvaluationReason.BREAKOUT_ALLOWED]: 'Content meets breakout rule requirements',
    [EvaluationReason.ALLOWED_COUNTRY]: 'Content is from an allowed country',
    [EvaluationReason.ALLOWED_LANGUAGE]: 'Content is in an allowed language',
    [EvaluationReason.NO_ACTIVE_POLICY]: 'No active policy is configured',
    [EvaluationReason.EXCLUDED_CONTENT_CLASS]: 'Content class is excluded by policy',
    [EvaluationReason.INVALID_CONTENT_CLASS]: 'Content has invalid or missing content class',
  };

  return descriptions;
}
