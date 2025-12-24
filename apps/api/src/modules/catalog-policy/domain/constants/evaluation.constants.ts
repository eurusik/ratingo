/**
 * Catalog Policy Evaluation Constants
 *
 * Centralized constants for eligibility statuses, run statuses, and evaluation reasons
 * to avoid magic strings throughout the codebase.
 */

/**
 * Eligibility Status Values (stored in DB)
 */
export const EligibilityStatus = {
  PENDING: 'pending',
  ELIGIBLE: 'eligible',
  INELIGIBLE: 'ineligible',
  REVIEW: 'review',
} as const;

export type EligibilityStatusType = (typeof EligibilityStatus)[keyof typeof EligibilityStatus];

/**
 * Virtual status for diff comparisons - item doesn't exist in evaluation set.
 * NOT stored in DB, only used in diff logic.
 */
export const DIFF_STATUS_NONE = 'none' as const;

/**
 * Evaluation Run Status Values
 */
export const RunStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PROMOTED: 'promoted',
  /** Legacy status - mapped to SUCCESS in read layer */
  COMPLETED: 'completed',
} as const;

export type RunStatusType = (typeof RunStatus)[keyof typeof RunStatus];

/** Run statuses that indicate the run is finished and can be diffed */
export const DIFFABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.SUCCESS, RunStatus.PROMOTED];

/** Run statuses that indicate the run can be cancelled */
export const CANCELLABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.RUNNING];

/**
 * Evaluation Reason Keys
 *
 * These are stored in the database and used for i18n lookups.
 * Human-readable descriptions are provided via getReasonDescriptions().
 */
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

/**
 * Default policy version for items that haven't been evaluated yet
 */
export const DEFAULT_POLICY_VERSION = 0;
