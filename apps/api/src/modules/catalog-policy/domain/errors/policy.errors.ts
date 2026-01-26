/**
 * Catalog Policy Domain Errors
 *
 * Domain-specific errors implementing fail-fast principle.
 * Invalid or unexpected values cause explicit errors rather than silent auto-fixing.
 */

import { EligibilityStatus, RunStatus } from '../constants/evaluation.constants';

/**
 * Thrown when eligibility status is not in canonical set.
 * Valid values: 'eligible', 'ineligible', 'review'.
 *
 * @example
 * throw new InvalidEligibilityStatusError('UNKNOWN');
 * // Error: Invalid eligibility status: 'UNKNOWN'. Expected one of: eligible, ineligible, review
 */
export class InvalidEligibilityStatusError extends Error {
  readonly invalidStatus: string;
  readonly validStatuses: string[];

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
 * Valid values: 'running', 'prepared', 'failed', 'cancelled', 'promoted'.
 *
 * Legacy values ('pending', 'success', 'completed') should be migrated at DB level.
 *
 * @example
 * throw new InvalidRunStatusError('completed');
 * // Error: Invalid run status: 'completed'. Expected one of: running, prepared, failed, cancelled, promoted.
 */
export class InvalidRunStatusError extends Error {
  readonly invalidStatus: string;
  readonly validStatuses: string[];

  constructor(status: string) {
    const validStatuses = Object.values(RunStatus);
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
 * // Error: Invalid breakout rule 'rule-1': priority must be non-negative
 */
export class InvalidBreakoutRuleError extends Error {
  readonly ruleId: string;
  readonly reason: string;

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
  readonly runId: string;
  readonly currentState: string;
  readonly attemptedAction: string;

  constructor(runId: string, currentState: string, attemptedAction: string) {
    super(`Cannot ${attemptedAction} run '${runId}' in state '${currentState}'`);
    this.name = 'InvalidRunStateTransitionError';
    this.runId = runId;
    this.currentState = currentState;
    this.attemptedAction = attemptedAction;
  }
}

/**
 * Thrown when a run is not found.
 *
 * @example
 * throw new RunNotFoundError('run-123');
 * // Error: Run run-123 not found
 */
export class RunNotFoundError extends Error {
  readonly runId: string;

  constructor(runId: string) {
    super(`Run ${runId} not found`);
    this.name = 'RunNotFoundError';
    this.runId = runId;
  }
}

/**
 * Thrown when a policy is not found.
 *
 * @example
 * throw new PolicyNotFoundError('policy-123');
 * // Error: Policy with id policy-123 not found
 */
export class PolicyNotFoundError extends Error {
  readonly policyId: string;

  constructor(policyId: string) {
    super(`Policy with id ${policyId} not found`);
    this.name = 'PolicyNotFoundError';
    this.policyId = policyId;
  }
}

/**
 * Thrown when policy validation fails due to business rule violations.
 */
export class PolicyValidationError extends Error {
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PolicyValidationError';
    this.details = details;
  }
}

/**
 * Base class for policy activation errors.
 */
export abstract class PolicyActivationError extends Error {
  abstract readonly code: string;
}

/**
 * Thrown when attempting to prepare a policy that is already active.
 */
export class PolicyAlreadyActiveError extends PolicyActivationError {
  readonly code = 'POLICY_ALREADY_ACTIVE';
  readonly policyId: string;

  constructor(policyId: string) {
    super(`Policy ${policyId} is already active`);
    this.name = 'PolicyAlreadyActiveError';
    this.policyId = policyId;
  }
}

/**
 * Thrown when attempting to prepare a policy while another run is in progress.
 */
export class RunAlreadyInProgressError extends PolicyActivationError {
  readonly code = 'RUN_ALREADY_IN_PROGRESS';
  readonly policyId: string;
  readonly existingRunId: string;

  constructor(policyId: string, existingRunId: string) {
    super(`A run is already in progress for policy ${policyId} (runId: ${existingRunId})`);
    this.name = 'RunAlreadyInProgressError';
    this.policyId = policyId;
    this.existingRunId = existingRunId;
  }
}

/**
 * Thrown when promotion is not allowed due to blocking conditions.
 */
export class PromotionNotAllowedError extends PolicyActivationError {
  readonly code = 'PROMOTION_NOT_ALLOWED';
  readonly runId: string;
  readonly reason: string;
  readonly details?: Record<string, unknown>;

  constructor(runId: string, reason: string, details?: Record<string, unknown>) {
    super(`Cannot promote run ${runId}: ${reason}`);
    this.name = 'PromotionNotAllowedError';
    this.runId = runId;
    this.reason = reason;
    this.details = details;
  }
}

/**
 * Thrown when an invalid evaluation context is provided.
 */
export class InvalidContextError extends PolicyActivationError {
  readonly code = 'INVALID_CONTEXT';
  readonly providedContext: string;
  readonly validContexts: string[];

  constructor(providedContext: string, validContexts: string[]) {
    super(`Invalid context '${providedContext}'. Must be one of: ${validContexts.join(', ')}`);
    this.name = 'InvalidContextError';
    this.providedContext = providedContext;
    this.validContexts = validContexts;
  }
}

/**
 * Thrown when no active policy exists for backfill operations.
 */
export class NoActivePolicyError extends PolicyActivationError {
  readonly code = 'NO_ACTIVE_POLICY';

  constructor() {
    super('No active policy found. Cannot perform operation without active policy.');
    this.name = 'NoActivePolicyError';
  }
}
