/**
 * Catalog Policy Evaluation Constants
 *
 * Defines canonical status values and reason codes for policy evaluation.
 */

/**
 * Eligibility status values (stored in DB).
 *
 * Note: PENDING was removed per Readability & Pending Reform.
 * Policy Engine now returns INELIGIBLE with specific reasons for missing data.
 */
export const EligibilityStatus = {
  ELIGIBLE: 'eligible',
  INELIGIBLE: 'ineligible',
  REVIEW: 'review',
} as const;

export type EligibilityStatusType = (typeof EligibilityStatus)[keyof typeof EligibilityStatus];

/**
 * Virtual status for diff comparisons.
 * NOT stored in DB.
 */
export const DIFF_STATUS_NONE = 'none' as const;

/**
 * Combines EligibilityStatusType with DIFF_STATUS_NONE for diff comparisons.
 */
export type DiffStatus = EligibilityStatusType | typeof DIFF_STATUS_NONE;

/**
 * Evaluation run status values.
 *
 * Lifecycle: running → prepared → promoted | cancelled | failed
 */
export const RunStatus = {
  RUNNING: 'running',
  PREPARED: 'prepared',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PROMOTED: 'promoted',
} as const;

export type RunStatusType = (typeof RunStatus)[keyof typeof RunStatus];

/**
 * Run statuses that can be diffed.
 */
export const DIFFABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.PREPARED, RunStatus.PROMOTED];

/**
 * Run statuses that can be cancelled.
 */
export const CANCELLABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.RUNNING, RunStatus.PREPARED];

/**
 * Run statuses that can be promoted.
 */
export const PROMOTABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.PREPARED];

/**
 * Blocking reason codes for run promotion.
 */
export const BlockingReasonCode = {
  RUN_NOT_SUCCESS: 'RUN_NOT_SUCCESS',
  COVERAGE_NOT_MET: 'COVERAGE_NOT_MET',
  ERRORS_EXCEEDED: 'ERRORS_EXCEEDED',
  ALREADY_PROMOTED: 'ALREADY_PROMOTED',
} as const;

export type BlockingReasonType = (typeof BlockingReasonCode)[keyof typeof BlockingReasonCode];

/**
 * Evaluation reason keys (stored in DB).
 */
export const EvaluationReason = {
  // Umbrella reason for any missing critical data
  MISSING_REQUIRED_METADATA: 'MISSING_REQUIRED_METADATA',

  // Missing data reasons (return INELIGIBLE with umbrella + specific)
  MISSING_ORIGIN_COUNTRY: 'MISSING_ORIGIN_COUNTRY',
  MISSING_ORIGINAL_LANGUAGE: 'MISSING_ORIGINAL_LANGUAGE',
  MISSING_TITLE: 'MISSING_TITLE',

  // Readability reasons (return INELIGIBLE)
  // CJK-heavy title without Latin/Cyrillic translation for UA audience
  MISSING_TRANSLATED_TITLE: 'MISSING_TRANSLATED_TITLE',

  // Context-dependent reasons (return INELIGIBLE)
  // Missing or too short overview for display surfaces that require it
  MISSING_OVERVIEW: 'MISSING_OVERVIEW',

  // Blocked reasons (return INELIGIBLE)
  BLOCKED_COUNTRY: 'BLOCKED_COUNTRY',
  BLOCKED_LANGUAGE: 'BLOCKED_LANGUAGE',

  // Neutral reasons (return INELIGIBLE - not in allowed/blocked lists)
  NEUTRAL_COUNTRY: 'NEUTRAL_COUNTRY',
  NEUTRAL_LANGUAGE: 'NEUTRAL_LANGUAGE',

  // Missing global signals (for breakout evaluation)
  MISSING_GLOBAL_SIGNALS: 'MISSING_GLOBAL_SIGNALS',

  // Success reasons (return ELIGIBLE)
  BREAKOUT_ALLOWED: 'BREAKOUT_ALLOWED',
  ALLOWED_COUNTRY: 'ALLOWED_COUNTRY',
  ALLOWED_LANGUAGE: 'ALLOWED_LANGUAGE',

  // Content class reasons
  EXCLUDED_CONTENT_CLASS: 'EXCLUDED_CONTENT_CLASS',
  INVALID_CONTENT_CLASS: 'INVALID_CONTENT_CLASS',

  // System reasons
  NO_ACTIVE_POLICY: 'NO_ACTIVE_POLICY', // Fallback when no policy exists
} as const;

export type EvaluationReasonType = (typeof EvaluationReason)[keyof typeof EvaluationReason];

/**
 * Default policy version for unevaluated items.
 */
export const DEFAULT_POLICY_VERSION = 0;

/**
 * Evaluation context values (stored in DB).
 * Determines which display surface the evaluation applies to.
 */
export const EvaluationContext = {
  CATALOG: 'catalog',
  TRENDING: 'trending',
  HOMEPAGE: 'homepage',
  NOW_PLAYING: 'now_playing',
  NEW_DIGITAL: 'new_digital',
  SEARCH: 'search',
} as const;

export type EvaluationContextType = (typeof EvaluationContext)[keyof typeof EvaluationContext];

/**
 * Default context for backward compatibility.
 */
export const DEFAULT_EVALUATION_CONTEXT: EvaluationContextType = EvaluationContext.CATALOG;

/**
 * Active evaluation contexts - the canonical list of contexts
 * that must be evaluated during policy activation.
 *
 * IMPORTANT: Only add contexts that are used by public API endpoints.
 * Do not add experimental contexts here.
 *
 * To add a new context:
 * 1. Add to this array
 * 2. Fan-out will automatically include it
 * 3. Create/update API endpoint to read from new context
 */
export const ACTIVE_EVALUATION_CONTEXTS: readonly EvaluationContextType[] = [
  EvaluationContext.CATALOG,
  EvaluationContext.TRENDING,
] as const;

/**
 * Default max age (in minutes) before a running run is considered stale.
 * Used by RunFinalizeService.finalizeStaleRuns().
 */
export const DEFAULT_STALE_RUN_MAX_AGE_MINUTES = 5;
