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
 *
 * Status lifecycle: running → prepared → promoted | cancelled | failed
 *
 * - RUNNING: Evaluation in progress
 * - PREPARED: Evaluation complete, ready for promotion (replaces legacy 'completed'/'success')
 * - PROMOTED: Policy activated, terminal state
 * - CANCELLED: User cancelled, terminal state
 * - FAILED: Error occurred, terminal state
 */
export const RunStatus = {
  RUNNING: 'running',
  PREPARED: 'prepared',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PROMOTED: 'promoted',
  /** @deprecated Legacy status - use PREPARED instead. Kept for backward compatibility during migration. */
  PENDING: 'pending',
  /** @deprecated Legacy status - use PREPARED instead. Kept for backward compatibility during migration. */
  SUCCESS: 'success',
  /** @deprecated Legacy status - use PREPARED instead. Kept for backward compatibility during migration. */
  COMPLETED: 'completed',
} as const;

export type RunStatusType = (typeof RunStatus)[keyof typeof RunStatus];

/** Active (non-deprecated) run status values */
export type ActiveRunStatusType = 'running' | 'prepared' | 'failed' | 'cancelled' | 'promoted';

/** Run statuses that indicate the run is finished and can be diffed */
export const DIFFABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.PREPARED, RunStatus.PROMOTED];

/** Run statuses that indicate the run can be cancelled */
export const CANCELLABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.RUNNING, RunStatus.PREPARED];

/** Run statuses that indicate the run can be promoted */
export const PROMOTABLE_RUN_STATUSES: RunStatusType[] = [RunStatus.PREPARED];

/**
 * Blocking Reason Codes
 *
 * Reasons why a run cannot be promoted.
 */
export const BlockingReasonCode = {
  RUN_NOT_SUCCESS: 'RUN_NOT_SUCCESS',
  COVERAGE_NOT_MET: 'COVERAGE_NOT_MET',
  ERRORS_EXCEEDED: 'ERRORS_EXCEEDED',
  ALREADY_PROMOTED: 'ALREADY_PROMOTED',
} as const;

export type BlockingReasonType = (typeof BlockingReasonCode)[keyof typeof BlockingReasonCode];

/**
 * Normalizes legacy status values to current status values.
 * Use this when reading from database to handle legacy data.
 */
export function normalizeRunStatus(status: string): ActiveRunStatusType {
  switch (status) {
    case 'pending':
      return 'running';
    case 'completed':
    case 'success':
      return 'prepared';
    default:
      return status as ActiveRunStatusType;
  }
}

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
