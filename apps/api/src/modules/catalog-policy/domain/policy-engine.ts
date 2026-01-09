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
  EvaluationContext,
  type EvaluationReasonType,
  type EvaluationContextType,
} from './constants/evaluation.constants';
import {
  type Evaluation,
  type PolicyConfig,
  type PolicyEngineInput,
  type BreakoutRule,
  type EvaluationOptions,
  type GlobalRequirements,
  type NormalizedOffer,
  type AvailabilityMode,
  type ContextRequirements,
} from './types/policy.types';

/**
 * Default contexts where gate applies when appliesTo not configured.
 * Quality-driven surfaces that require maturity signals.
 */
const DEFAULT_QUALITY_CONTEXTS: EvaluationContextType[] = [
  EvaluationContext.CATALOG,
  EvaluationContext.HOMEPAGE,
  EvaluationContext.TRENDING,
  EvaluationContext.SEARCH,
];

/**
 * Default minimum overview length in characters for contexts that require overview.
 * Used when requireOverview=true and minOverviewChars is not configured.
 */
const DEFAULT_MIN_OVERVIEW_CHARS = 60;

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
  context: EvaluationContextType = EvaluationContext.CATALOG,
): boolean {
  if (!requirements) return false;
  const appliesTo = requirements.appliesTo ?? DEFAULT_QUALITY_CONTEXTS;
  return appliesTo.includes(context);
}

/**
 * Evaluates media eligibility based on policy rules.
 *
 * Evaluation order (Requirements: 6.1, 6.4, 6.5):
 * 1. Data Integrity (origin/language/title) → INELIGIBLE with umbrella + specific reason
 * 2. Display Gates (readability/overview) → INELIGIBLE with specific reason
 * 3. Content Class Exclusion (SOFT filter - breakout can override)
 * 4. Blocked Checks (HARD filter - breakout cannot override)
 * 5. Global Quality Gate (if configured)
 * 6. Breakout Rules
 * 7. Neutral/Allowed Checks
 *
 * Note: PENDING status is no longer returned by Policy Engine.
 * All missing data cases return INELIGIBLE with specific reasons.
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
  const context = options?.context ?? EvaluationContext.CATALOG;

  // ============================================================================
  // STEP 1: DATA INTEGRITY CHECKS
  // Missing critical metadata → INELIGIBLE with umbrella + specific reason
  // Order: origin countries → original language → title
  // ============================================================================
  if (!mediaItem.originCountries || mediaItem.originCountries.length === 0) {
    reasons.push(EvaluationReason.MISSING_REQUIRED_METADATA);
    reasons.push(EvaluationReason.MISSING_ORIGIN_COUNTRY);
    return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
  }

  if (!mediaItem.originalLanguage) {
    reasons.push(EvaluationReason.MISSING_REQUIRED_METADATA);
    reasons.push(EvaluationReason.MISSING_ORIGINAL_LANGUAGE);
    return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
  }

  // Check title is not null/empty (Requirements: 1.4, 2.4)
  if (!mediaItem.title || mediaItem.title.trim().length === 0) {
    reasons.push(EvaluationReason.MISSING_REQUIRED_METADATA);
    reasons.push(EvaluationReason.MISSING_TITLE);
    return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
  }

  // ============================================================================
  // STEP 2: DISPLAY GATES CHECKS
  // Context-dependent readability and overview requirements
  // Requirements: 3.4, 4.3, 4.4, 4.7
  // ============================================================================
  const contextRequirements = getContextRequirements(policy, context);

  // Check readability if requireReadableTitle=true
  if (contextRequirements.requireReadableTitle && !isReadableTitle(mediaItem.title)) {
    reasons.push(EvaluationReason.MISSING_TRANSLATED_TITLE);
    return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
  }

  // Check overview if requireOverview=true
  if (contextRequirements.requireOverview) {
    const overview = mediaItem.overview?.trim() ?? '';
    // Check for placeholders like "TBA", "N/A", "Coming soon"
    const isPlaceholder = /^(tba|n\/a|coming soon|to be announced)$/i.test(overview);
    if (
      overview.length === 0 ||
      isPlaceholder ||
      overview.length < contextRequirements.minOverviewChars
    ) {
      reasons.push(EvaluationReason.MISSING_OVERVIEW);
      return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
    }
  }

  // ============================================================================
  // STEP 3: CONTENT CLASS EXCLUSION CHECK (SOFT filter)
  // Breakout rules CAN override this exclusion
  // ============================================================================
  const isContentClassExcluded = checkContentClassExcluded(
    mediaItem.contentClass,
    policy.excludedContentClasses,
  );

  // ============================================================================
  // STEP 4: BLOCKED CHECKS (HARD filter)
  // Breakout rules CANNOT override hard blocks
  // ============================================================================
  const isBlocked = checkBlocked(mediaItem, policy, reasons);

  // Handle excluded content class with breakout opportunity
  if (isContentClassExcluded) {
    // ============================================================================
    // STEP 5: GLOBAL QUALITY GATE (for excluded content)
    // Gate must pass before breakout is attempted
    // ============================================================================
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

    // ============================================================================
    // STEP 6: BREAKOUT RULES (for excluded content)
    // ============================================================================
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
    // ============================================================================
    // STEP 5: GLOBAL QUALITY GATE (for blocked content)
    // Breakout rules require gate to pass
    // ============================================================================
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

    // ============================================================================
    // STEP 6: BREAKOUT RULES (for blocked content, gate passed or not configured)
    // ============================================================================
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

  // ============================================================================
  // STEP 5: GLOBAL QUALITY GATE (for non-blocked content) - CONTEXT AWARE
  // ============================================================================
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

  // ============================================================================
  // STEP 7: NEUTRAL/ALLOWED CHECKS
  // Content not in blocked lists - check if in allowed or neutral
  // ============================================================================
  const isNeutral = checkNeutral(mediaItem, policy, reasons);

  if (isNeutral) {
    // Neutral content is INELIGIBLE unless eligibilityMode is RELAXED
    const relaxedResult = tryRelaxedModeEligibility(mediaItem, policy);
    if (relaxedResult) return relaxedResult;

    return { status: EligibilityStatus.INELIGIBLE, reasons, breakoutRuleId: null };
  }

  // ============================================================================
  // STEP 7 (continued): ALLOWED CHECKS (whitelist)
  // If we reach here, content is in allowed lists
  // ============================================================================
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
  _policy: PolicyConfig,
): boolean {
  const { mediaItem } = input;
  const { requirements } = rule;

  // Check originCountries (ANY intersection)
  if (requirements.originCountries && requirements.originCountries.length > 0) {
    if (!mediaItem.originCountries || mediaItem.originCountries.length === 0) {
      return false;
    }
    const hasMatchingCountry = requirements.originCountries.some((country) =>
      mediaItem.originCountries!.includes(country),
    );
    if (!hasMatchingCountry) {
      return false;
    }
  }

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
    if (
      !hasAnyProvider(mediaItem.normalizedOffers, requirements.requireAnyOfProviders, requirements)
    ) {
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
 * Uses normalized offers with canonical provider IDs.
 *
 * @param offers - Normalized watch offers with canonical provider IDs
 * @param requiredProviders - Canonical provider IDs (e.g., 'netflix', 'disney_plus')
 * @param requirements - Breakout rule requirements for filtering
 * @returns True if any required provider is present (after filtering)
 */
function hasAnyProvider(
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

/**
 * Filters offers based on breakout rule requirements.
 *
 * @param offers - All normalized offers
 * @param requirements - Breakout rule requirements
 * @returns Filtered offers
 */
function filterOffersByRequirements(
  offers: NormalizedOffer[],
  requirements: BreakoutRule['requirements'],
): NormalizedOffer[] {
  let filtered = offers;

  // Filter by availability mode
  const availabilityMode = requirements.availabilityMode ?? 'subscription_only';
  filtered = filterByAvailabilityMode(filtered, availabilityMode);

  // Filter by excludeAdsTiers
  if (requirements.excludeAdsTiers) {
    filtered = filtered.filter((offer) => !offer.isAdsTier);
  }

  // Filter by excludeChannelDistribution (only direct)
  if (requirements.excludeChannelDistribution) {
    filtered = filtered.filter((offer) => offer.distributionChannel === 'direct');
  }

  return filtered;
}

/**
 * Filters offers by availability mode.
 *
 * @param offers - Offers to filter
 * @param mode - Availability mode
 * @returns Filtered offers
 */
function filterByAvailabilityMode(
  offers: NormalizedOffer[],
  mode: AvailabilityMode,
): NormalizedOffer[] {
  switch (mode) {
    case 'subscription_only':
      return offers.filter((o) => o.offerType === 'flatrate');
    case 'transactional_only':
      return offers.filter((o) => o.offerType === 'rent' || o.offerType === 'buy');
    case 'any':
      return offers;
    default:
      return offers;
  }
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
 * Checks if title is readable for UA audience.
 *
 * Rules:
 * 1. If title has 2+ Latin/Cyrillic letters → readable (regardless of other chars)
 * 2. If title length > 6 AND CJK > 60% of letters AND < 2 Latin/Cyrillic → unreadable
 * 3. Otherwise → readable (short titles, mixed content)
 *
 * @param title - Display title to check
 * @returns true if readable, false if CJK-heavy without translation
 */
export function isReadableTitle(title: string): boolean {
  // Constants for readability rules
  const MIN_LATIN_CYRILLIC_FOR_READABLE = 2;
  const MIN_TITLE_LENGTH_FOR_CJK_CHECK = 6;
  const CJK_HEAVY_THRESHOLD = 0.6;

  if (!title || title.length === 0) {
    return false; // Empty title handled by data integrity check
  }

  // Count character types (letters only, not digits/punctuation)
  // Using Unicode property escapes for script detection
  const latinCyrillicRegex = /[\p{Script=Latin}\p{Script=Cyrillic}]/gu;
  const cjkRegex = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

  const latinCyrillicMatches = title.match(latinCyrillicRegex) || [];
  const cjkMatches = title.match(cjkRegex) || [];

  const latinCyrillicCount = latinCyrillicMatches.length;
  const cjkCount = cjkMatches.length;
  const totalLetters = latinCyrillicCount + cjkCount;

  // Rule 1: 2+ Latin/Cyrillic letters = always readable
  if (latinCyrillicCount >= MIN_LATIN_CYRILLIC_FOR_READABLE) {
    return true;
  }

  // Rule 2: Long CJK-heavy title without Latin/Cyrillic = unreadable
  if (title.length > MIN_TITLE_LENGTH_FOR_CJK_CHECK && totalLetters > 0) {
    const cjkRatio = cjkCount / totalLetters;
    if (cjkRatio > CJK_HEAVY_THRESHOLD && latinCyrillicCount < MIN_LATIN_CYRILLIC_FOR_READABLE) {
      return false;
    }
  }

  // Rule 3: Short titles or mixed content = readable
  return true;
}

/**
 * Returns default context requirements for a given context.
 *
 * Defaults:
 * - requireReadableTitle: true (all contexts)
 * - requireOverview: true (trending, homepage), false (others)
 * - minOverviewChars: 60 (when requireOverview=true)
 *
 * @param context - Evaluation context type
 * @returns Required context requirements with all fields populated
 */
export function getDefaultContextRequirements(
  context: EvaluationContextType,
): Required<ContextRequirements> {
  const requireOverview =
    context === EvaluationContext.TRENDING || context === EvaluationContext.HOMEPAGE;

  return {
    requireReadableTitle: true,
    requireOverview,
    minOverviewChars: requireOverview ? DEFAULT_MIN_OVERVIEW_CHARS : 0,
  };
}

/**
 * Merges policy context requirements with defaults.
 * Returns fully populated context requirements for the given context.
 *
 * @param policy - Policy configuration (may have partial contextRequirements)
 * @param context - Evaluation context type
 * @returns Required context requirements with all fields populated
 */
export function getContextRequirements(
  policy: PolicyConfig,
  context: EvaluationContextType,
): Required<ContextRequirements> {
  const defaults = getDefaultContextRequirements(context);
  const configured = policy.contextRequirements?.[context];

  if (!configured) {
    return defaults;
  }

  return {
    requireReadableTitle: configured.requireReadableTitle ?? defaults.requireReadableTitle,
    requireOverview: configured.requireOverview ?? defaults.requireOverview,
    minOverviewChars: configured.minOverviewChars ?? defaults.minOverviewChars,
  };
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
    // Umbrella reason
    [EvaluationReason.MISSING_REQUIRED_METADATA]:
      'Required metadata is missing (see specific reason for details)',

    // Missing data reasons
    [EvaluationReason.MISSING_ORIGIN_COUNTRY]: 'Origin country information is missing',
    [EvaluationReason.MISSING_ORIGINAL_LANGUAGE]: 'Original language information is missing',
    [EvaluationReason.MISSING_TITLE]: 'Title is missing or empty',

    // Readability reasons
    [EvaluationReason.MISSING_TRANSLATED_TITLE]:
      'Title is not readable for UA audience (CJK-heavy without Latin/Cyrillic translation)',

    // Context-dependent reasons
    [EvaluationReason.MISSING_OVERVIEW]:
      'Overview is missing or too short for this display context',

    // Blocked reasons
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
