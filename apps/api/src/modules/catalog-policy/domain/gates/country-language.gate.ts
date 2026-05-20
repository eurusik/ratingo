/**
 * Country-Language Gate
 *
 * Checks content against allowed/blocked country and language lists.
 * Handles STRICT and RELAXED eligibility modes.
 */

import {
  EligibilityStatus,
  EvaluationReason,
  type EvaluationReasonType,
} from '../constants/evaluation.constants';
import {
  EligibilityMode,
  BlockedCountryMode,
  type Evaluation,
  type PolicyConfig,
  type PolicyEngineInput,
  type BlockedCountryModeType,
} from '../types/policy.types';

/**
 * Result of blocked check.
 */
export interface BlockedCheckResult {
  /** True if content is blocked */
  isBlocked: boolean;
  /** Accumulated blocking reasons */
  reasons: EvaluationReasonType[];
}

/**
 * Result of neutral check.
 */
export interface NeutralCheckResult {
  /** True if content is in neutral zone (not allowed, not blocked) */
  isNeutral: boolean;
  /** Accumulated neutral reasons */
  reasons: EvaluationReasonType[];
}

/**
 * Determines if content is blocked based on country blocking mode.
 *
 * MAJORITY mode behavior:
 * - For titles with ≤ 2 origin countries, behaves identically to ANY mode (one blocked = blocked).
 *   This is an intentional tie-breaker: majority cannot be established without a minimum quorum.
 *   In practice, most titles have exactly 1 origin country, so MAJORITY ≈ ANY for them.
 *   Admins switching from ANY to MAJORITY will see no change for single-country titles.
 * - For 3+ countries, majority (≥ ceil(N/2) blocked) must be true; ties (e.g. 2 of 4) count as blocked.
 */
function isBlockedByCountryRule(
  blockedCount: number,
  totalCountries: number,
  mode: BlockedCountryModeType,
): boolean {
  // ANY mode: any blocked country = blocked
  if (mode === BlockedCountryMode.ANY) return true;

  // MAJORITY mode with tie-breaker: for 1-2 countries, fallback to ANY
  if (totalCountries <= 2) return true;

  // For 3+ countries, use majority rule
  const majority = Math.ceil(totalCountries / 2);
  return blockedCount >= majority;
}

/**
 * Checks if media is blocked by country or language rules.
 *
 * @param mediaItem - Media item data (must have valid originCountries and originalLanguage)
 * @param policy - Policy configuration
 * @returns Result with blocked status and reasons
 */
export function checkBlocked(
  mediaItem: PolicyEngineInput['mediaItem'],
  policy: PolicyConfig,
): BlockedCheckResult {
  const reasons: EvaluationReasonType[] = [];
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

  return { isBlocked, reasons };
}

/**
 * Checks if media is neutral (not in allowed or blocked lists).
 *
 * @param mediaItem - Media item data (must have valid originCountries and originalLanguage)
 * @param policy - Policy configuration
 * @returns Result with neutral status and reasons
 */
export function checkNeutral(
  mediaItem: PolicyEngineInput['mediaItem'],
  policy: PolicyConfig,
): NeutralCheckResult {
  const reasons: EvaluationReasonType[] = [];
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

  return { isNeutral, reasons };
}

/**
 * Checks if neutral content can be eligible under RELAXED mode.
 * Returns evaluation result if eligible, null otherwise.
 *
 * @param mediaItem - Media item data (must have valid originCountries and originalLanguage)
 * @param policy - Policy configuration
 * @returns Evaluation if eligible under RELAXED mode, null otherwise
 */
export function tryRelaxedModeEligibility(
  mediaItem: PolicyEngineInput['mediaItem'],
  policy: PolicyConfig,
): Evaluation | null {
  if (policy.eligibilityMode !== EligibilityMode.RELAXED) return null;

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
