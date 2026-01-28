/**
 * Catalog Policy Engine - Orchestrator
 *
 * Core business logic for evaluating media eligibility based on policy rules.
 * All functions are pure (no side effects) for deterministic, testable behavior.
 *
 * This module orchestrates evaluation by delegating to specialized gates and evaluators:
 * - gates/data-integrity.gate.ts - Validates required metadata
 * - gates/display.gate.ts - Context-dependent readability/overview checks
 * - gates/country-language.gate.ts - Blocked/neutral/allowed checks
 * - gates/global-requirements.gate.ts - Quality gate (ratings, votes, scores)
 * - evaluators/breakout-rule.evaluator.ts - Breakout rule matching
 */

import { type ContentClass } from './classification.service';
import {
  EligibilityStatus,
  EvaluationReason,
  EvaluationContext,
  type EvaluationReasonType,
  type EvaluationContextType,
} from './constants/evaluation.constants';
import { findMatchingBreakoutRule } from './evaluators';
import {
  checkDataIntegrity,
  checkDisplayGates,
  checkBlocked,
  checkNeutral,
  tryRelaxedModeEligibility,
  checkGlobalRequirements,
  shouldApplyGlobalGate,
} from './gates';
import type {
  Evaluation,
  PolicyConfig,
  PolicyEngineInput,
  EvaluationOptions,
} from './types/policy.types';

// Re-export utilities for backward compatibility
export { isReadableTitle } from './utils/title-readability';
export { shouldApplyGlobalGate };
export { getContextRequirements, getDefaultContextRequirements } from './gates/display.gate';

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
 * Evaluates media eligibility based on policy rules.
 *
 * Evaluation order:
 * 1. Data Integrity - validates origin countries, language, title
 * 2. Display Gates - context-dependent readability and overview checks
 * 3. Content Class Exclusion - SOFT filter, breakout rules CAN override
 * 4. Blocked Checks - HARD filter, breakout rules CANNOT override
 * 5. Global Quality Gate - context-aware quality requirements
 * 6. Neutral/Allowed Checks - with breakout opportunity for neutral content
 *
 * @param input - Media item data and stats
 * @param policy - Active policy configuration
 * @param options - Evaluation options (context)
 * @returns Evaluation result with status, reasons, and breakoutRuleId
 */
export function evaluateEligibility(
  input: PolicyEngineInput,
  policy: PolicyConfig,
  options?: EvaluationOptions,
): Evaluation {
  const { mediaItem } = input;
  const context = options?.context ?? EvaluationContext.CATALOG;

  // STEP 1: DATA INTEGRITY CHECKS
  const dataIntegrityResult = checkDataIntegrity(mediaItem);
  if (!dataIntegrityResult.passes) {
    return dataIntegrityResult.evaluation!;
  }

  // STEP 2: DISPLAY GATES CHECKS
  const displayResult = checkDisplayGates(mediaItem, policy, context);
  if (!displayResult.passes) {
    return displayResult.evaluation!;
  }

  // STEP 3: CONTENT CLASS EXCLUSION CHECK (SOFT filter)
  const isContentClassExcluded = checkContentClassExcluded(
    mediaItem.contentClass,
    policy.excludedContentClasses,
  );

  // STEP 4: BLOCKED CHECKS (HARD filter - NO breakout allowed)
  const blockedResult = checkBlocked(mediaItem, policy);

  // Blocked content is always INELIGIBLE - this is a HARD filter
  if (blockedResult.isBlocked) {
    return handleBlockedContent(blockedResult.reasons, isContentClassExcluded);
  }

  // Handle excluded content class with breakout opportunity (SOFT filter)
  if (isContentClassExcluded) {
    return handleExcludedContent(input, policy, context);
  }

  // STEP 5: GLOBAL QUALITY GATE - CONTEXT AWARE
  let localMaturityOverrideApplied = false;
  if (shouldApplyGlobalGate(policy.globalRequirements, context)) {
    const gateResult = checkGlobalRequirements(input, policy.globalRequirements);
    if (!gateResult.passes) {
      return {
        status: EligibilityStatus.INELIGIBLE,
        reasons: [EvaluationReason.MISSING_GLOBAL_SIGNALS],
        breakoutRuleId: null,
        globalGateDetails: { failedChecks: gateResult.failedChecks },
      };
    }
    localMaturityOverrideApplied = gateResult.localMaturityOverrideApplied ?? false;
  }

  // STEP 6: NEUTRAL/ALLOWED CHECKS with breakout opportunity
  const neutralResult = checkNeutral(mediaItem, policy);

  if (neutralResult.isNeutral) {
    return handleNeutralContent(input, policy, neutralResult.reasons, localMaturityOverrideApplied);
  }

  // Content is in allowed lists
  const reasons: EvaluationReasonType[] = [
    EvaluationReason.ALLOWED_COUNTRY,
    EvaluationReason.ALLOWED_LANGUAGE,
  ];
  if (localMaturityOverrideApplied) {
    reasons.push(EvaluationReason.ALLOWED_LOCAL_MATURITY);
  }

  return {
    status: EligibilityStatus.ELIGIBLE,
    reasons,
    breakoutRuleId: null,
  };
}

/**
 * Handles evaluation for blocked content (HARD filter).
 * Blocked content is ALWAYS ineligible - breakout rules CANNOT override.
 */
function handleBlockedContent(
  blockedReasons: EvaluationReasonType[],
  isContentClassExcluded: boolean,
): Evaluation {
  const reasons = isContentClassExcluded
    ? [EvaluationReason.EXCLUDED_CONTENT_CLASS, ...blockedReasons]
    : blockedReasons;

  return {
    status: EligibilityStatus.INELIGIBLE,
    reasons,
    breakoutRuleId: null,
  };
}

/**
 * Handles evaluation for excluded content class (SOFT filter).
 * Breakout rules CAN override content class exclusion.
 * Context is respected for global gate.
 */
function handleExcludedContent(
  input: PolicyEngineInput,
  policy: PolicyConfig,
  context: EvaluationContextType,
): Evaluation {
  // Global gate must pass before breakout is attempted (context-aware)
  if (shouldApplyGlobalGate(policy.globalRequirements, context)) {
    const gateResult = checkGlobalRequirements(input, policy.globalRequirements);
    if (!gateResult.passes) {
      return {
        status: EligibilityStatus.INELIGIBLE,
        reasons: [EvaluationReason.EXCLUDED_CONTENT_CLASS],
        breakoutRuleId: null,
        globalGateDetails: { failedChecks: gateResult.failedChecks },
      };
    }
  }

  // Try breakout rules
  const breakoutRule = findMatchingBreakoutRule(input, policy);

  if (breakoutRule) {
    return {
      status: EligibilityStatus.ELIGIBLE,
      reasons: [EvaluationReason.EXCLUDED_CONTENT_CLASS, EvaluationReason.BREAKOUT_ALLOWED],
      breakoutRuleId: breakoutRule.id,
    };
  }

  // Excluded without breakout -> INELIGIBLE
  return {
    status: EligibilityStatus.INELIGIBLE,
    reasons: [EvaluationReason.EXCLUDED_CONTENT_CLASS],
    breakoutRuleId: null,
  };
}

/**
 * Handles evaluation for neutral content (not in allowed/blocked lists).
 * Breakout rules CAN make neutral content eligible.
 * This allows global hits like "Squid Game" from neutral countries (Korea) to pass.
 *
 * Note: Global gate has already been checked in the main flow before this function is called.
 */
function handleNeutralContent(
  input: PolicyEngineInput,
  policy: PolicyConfig,
  neutralReasons: EvaluationReasonType[],
  localMaturityOverrideApplied = false,
): Evaluation {
  // First try RELAXED mode eligibility
  const relaxedResult = tryRelaxedModeEligibility(input.mediaItem, policy);
  if (relaxedResult) {
    if (localMaturityOverrideApplied) {
      relaxedResult.reasons = [...relaxedResult.reasons, EvaluationReason.ALLOWED_LOCAL_MATURITY];
    }
    return relaxedResult;
  }

  // Global gate has already passed at this point (checked in main flow).
  // Try breakout rules for neutral content.
  const breakoutRule = findMatchingBreakoutRule(input, policy);

  if (breakoutRule) {
    const reasons: EvaluationReasonType[] = [EvaluationReason.BREAKOUT_ALLOWED];
    if (localMaturityOverrideApplied) {
      reasons.push(EvaluationReason.ALLOWED_LOCAL_MATURITY);
    }
    return {
      status: EligibilityStatus.ELIGIBLE,
      reasons,
      breakoutRuleId: breakoutRule.id,
    };
  }

  // Neutral without breakout -> INELIGIBLE
  return {
    status: EligibilityStatus.INELIGIBLE,
    reasons: neutralReasons,
    breakoutRuleId: null,
  };
}

/**
 * Computes relevance score (0-100) for homepage ranking.
 * Uses weighted average: quality 40%, popularity 40%, freshness 20%.
 *
 * @param input - Media item data and stats
 * @param _policy - Policy configuration (unused, kept for API compatibility)
 * @returns Relevance score in range [0, 100]
 */
export function computeRelevance(input: PolicyEngineInput, _policy: PolicyConfig): number {
  const QUALITY_WEIGHT = 0.4;
  const POPULARITY_WEIGHT = 0.4;
  const FRESHNESS_WEIGHT = 0.2;
  const MAX_SCORE = 100;

  if (!input.stats) {
    return 0;
  }

  const { qualityScore, popularityScore, freshnessScore } = input.stats;

  // Guard against NaN values
  const quality = Number.isNaN(qualityScore ?? NaN) ? 0 : (qualityScore ?? 0);
  const popularity = Number.isNaN(popularityScore ?? NaN) ? 0 : (popularityScore ?? 0);
  const freshness = Number.isNaN(freshnessScore ?? NaN) ? 0 : (freshnessScore ?? 0);

  const normalized =
    quality * QUALITY_WEIGHT + popularity * POPULARITY_WEIGHT + freshness * FRESHNESS_WEIGHT;

  const result = Math.round(normalized * MAX_SCORE);

  if (Number.isNaN(result) || result < 0) return 0;
  if (result > MAX_SCORE) return MAX_SCORE;

  return result;
}

/**
 * Returns human-readable descriptions for evaluation reasons.
 *
 * @param _reasons - List of evaluation reasons (unused, kept for API compatibility)
 * @returns Dictionary of reason descriptions
 */
export function getReasonDescriptions(
  _reasons: EvaluationReasonType[],
): Record<EvaluationReasonType, string> {
  return {
    [EvaluationReason.MISSING_REQUIRED_METADATA]:
      'Required metadata is missing (see specific reason for details)',
    [EvaluationReason.MISSING_ORIGIN_COUNTRY]: 'Origin country information is missing',
    [EvaluationReason.MISSING_ORIGINAL_LANGUAGE]: 'Original language information is missing',
    [EvaluationReason.MISSING_TITLE]: 'Title is missing or empty',
    [EvaluationReason.MISSING_TRANSLATED_TITLE]:
      'Title is not readable for UA audience (CJK-heavy without Latin/Cyrillic translation)',
    [EvaluationReason.MISSING_OVERVIEW]:
      'Overview is missing or too short for this display context',
    [EvaluationReason.BLOCKED_COUNTRY]: 'Content is from a blocked country',
    [EvaluationReason.BLOCKED_LANGUAGE]: 'Content is in a blocked language',
    [EvaluationReason.NEUTRAL_COUNTRY]: 'Content is from a neutral country (not in allowed list)',
    [EvaluationReason.NEUTRAL_LANGUAGE]: 'Content is in a neutral language (not in allowed list)',
    [EvaluationReason.MISSING_GLOBAL_SIGNALS]:
      'Content lacks required global signals (ratings, votes, providers)',
    [EvaluationReason.ALLOWED_LOCAL_MATURITY]:
      'Content passed via local maturity override (fresh content with strong platform engagement)',
    [EvaluationReason.BREAKOUT_ALLOWED]: 'Content meets breakout rule requirements',
    [EvaluationReason.ALLOWED_COUNTRY]: 'Content is from an allowed country',
    [EvaluationReason.ALLOWED_LANGUAGE]: 'Content is in an allowed language',
    [EvaluationReason.NO_ACTIVE_POLICY]: 'No active policy is configured',
    [EvaluationReason.EXCLUDED_CONTENT_CLASS]: 'Content class is excluded by policy',
    [EvaluationReason.INVALID_CONTENT_CLASS]: 'Content has invalid or missing content class',
  };
}
