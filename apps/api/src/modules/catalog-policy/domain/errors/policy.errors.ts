/**
 * Catalog Policy Domain Errors
 *
 * Domain-specific errors implementing fail-fast principle.
 * Invalid or unexpected values cause explicit errors rather than silent auto-fixing.
 */

import { EligibilityStatus, RunStatus } from '../constants/evaluation.constants';

/**
 * Thrown when eligibility status is not in canonical set.
 *
 * Valid values: 'pending', 'eligible', 'ineligible', 'review'.
 *
 * @example
 * throw new InvalidEligibilityStatusError('PENDING');
 * // Error: Invalid eligibility status: 'PENDING'. Expected one of: pending, eligible, ineligible, review
 */
export class InvalidEligibilityStatusError extends Error {
  public readonly invalidStatus: string;
  public readonly validStatuses: string[];

  /**
   * @param status - The invalid status value that was encountered
   */
  constructor(status: string) {
    const validStatuses = Object.values(EligibilityStatus);
    super(`Invalid eligibility status: '${status}'. Expected one of: ${validStatuses.join(', ')}`);
    this.name = 'InvalidEligibilityStatusError';
    this.invalidStatus = status;
    this.validStatuses = validStatuses;
  }
}

/**
 * Thrown when run status is not in canonical set.
 *
 * Valid values: 'running', 'prepared', 'failed', 'cancelled', 'promoted'.
 * Legacy values ('pending', 'success', 'completed') should be migrated at DB level.
 *
 * @example
 * throw new InvalidRunStatusError('completed');
 * // Error: Invalid run status: 'completed'. Expected one of: running, prepared, failed, cancelled, promoted. Legacy values must be migrated at database level.
 */
export class InvalidRunStatusError extends Error {
  public readonly invalidStatus: string;
  public readonly validStatuses: string[];

  /**
   * @param status - The invalid status value that was encountered
   */
  constructor(status: string) {
    // Only canonical (non-deprecated) statuses are valid
    const validStatuses = ['running', 'prepared', 'failed', 'cancelled', 'promoted'];
    super(
      `Invalid run status: '${status}'. Expected one of: ${validStatuses.join(', ')}. Legacy values must be migrated at database level.`,
    );
    this.name = 'InvalidRunStatusError';
    this.invalidStatus = status;
    this.validStatuses = validStatuses;
  }
}

/**
 * Thrown when breakout rule configuration is invalid.
 *
 * @example
 * throw new InvalidBreakoutRuleError('rule-1', 'priority must be non-negative');
 */
export class InvalidBreakoutRuleError extends Error {
  public readonly ruleId: string;
  public readonly reason: string;

  /**
   * @param ruleId - The ID of the invalid breakout rule
   * @param reason - Description of why the rule is invalid
   */
  constructor(ruleId: string, reason: string) {
    super(`Invalid breakout rule '${ruleId}': ${reason}`);
    this.name = 'InvalidBreakoutRuleError';
    this.ruleId = ruleId;
    this.reason = reason;
  }
}

/**
 * Thrown when invalid run state transition is attempted.
 *
 * Valid transitions:
 * - RUNNING → PREPARED | FAILED | CANCELLED
 * - PREPARED → PROMOTED | CANCELLED
 * - PROMOTED, CANCELLED, FAILED are terminal states
 *
 * @example
 * throw new InvalidRunStateTransitionError('run-123', 'promoted', 'cancel');
 * // Error: Cannot cancel run 'run-123' in state 'promoted'
 */
export class InvalidRunStateTransitionError extends Error {
  public readonly runId: string;
  public readonly currentState: string;
  public readonly attemptedAction: string;

  /**
   * @param runId - The ID of the run
   * @param currentState - Current state of the run
   * @param attemptedAction - Action that was attempted (e.g., 'promote', 'cancel')
   */
  constructor(runId: string, currentState: string, attemptedAction: string) {
    super(`Cannot ${attemptedAction} run '${runId}' in state '${currentState}'`);
    this.name = 'InvalidRunStateTransitionError';
    this.runId = runId;
    this.currentState = currentState;
    this.attemptedAction = attemptedAction;
  }
}
