/**
 * Catalog Policy Evaluation Constants
 */

/** Eligibility status values (stored in DB). */
export const EligibilityStatus = {
  PENDING: 'pending',
  ELIGIBLE: 'eligible',
  INELIGIBLE: 'ineligible',
  REVIEW: 'review',
} as const;

export type EligibilityStatusType = (typeof EligibilityStatus)[keyof typeof EligibilityStatus];

/** Virtual status for diff comparisons. NOT stored in DB. */
export const DIFF_STATUS_NONE = 'none' as const;

/** Combines EligibilityStatusType with DIFF_STATUS_NONE for diff comparisons. */
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

export type ActiveRunStatusType = 'running' | 'prepared' | 'failed' | 'cancelled' | 'promoted';

/** Run statuses that can be diffed. */
export const DIFFABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.PREPARED, RunStatus.PROMOTED];

/** Run statuses that can be cancelled. */
export const CANCELLABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.RUNNING, RunStatus.PREPARED];

/** Run statuses that can be promoted. */
export const PROMOTABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.PREPARED];

/** Blocking reason codes for run promotion. */
export const BlockingReasonCode = {
  RUN_NOT_SUCCESS: 'RUN_NOT_SUCCESS',
  COVERAGE_NOT_MET: 'COVERAGE_NOT_MET',
  ERRORS_EXCEEDED: 'ERRORS_EXCEEDED',
  ALREADY_PROMOTED: 'ALREADY_PROMOTED',
} as const;

export type BlockingReasonType = (typeof BlockingReasonCode)[keyof typeof BlockingReasonCode];

/** Evaluation reason keys (stored in DB). */
export const EvaluationReason = {
  // Missing data reasons (return PENDING)
  MISSING_ORIGIN_COUNTRY: 'MISSING_ORIGIN_COUNTRY',
  MISSING_ORIGINAL_LANGUAGE: 'MISSING_ORIGINAL_LANGUAGE',

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

  // System reasons
  NO_ACTIVE_POLICY: 'NO_ACTIVE_POLICY', // Fallback when no policy exists
} as const;

export type EvaluationReasonType = (typeof EvaluationReason)[keyof typeof EvaluationReason];

/** Default policy version for unevaluated items. */
export const DEFAULT_POLICY_VERSION = 0;
