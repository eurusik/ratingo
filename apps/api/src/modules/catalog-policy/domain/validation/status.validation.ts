/**
 * Status validation with fail-fast principle.
 */

import {
  EligibilityStatus,
  type EligibilityStatusType,
  RunStatus,
  type RunStatusType,
} from '../constants/evaluation.constants';
import { InvalidEligibilityStatusError } from '../errors/policy.errors';

/**
 * Validates eligibility status is canonical value.
 *
 * @param status - Status value to validate
 * @returns Validated status
 * @throws {InvalidEligibilityStatusError} When status invalid
 */
export function validateStatus(status: string): EligibilityStatusType {
  const validStatuses = Object.values(EligibilityStatus) as string[];

  if (!validStatuses.includes(status)) {
    throw new InvalidEligibilityStatusError(status);
  }

  return status as EligibilityStatusType;
}

/**
 * Type guard for eligibility status.
 */
export function isValidEligibilityStatus(status: unknown): status is EligibilityStatusType {
  if (typeof status !== 'string') return false;
  return (Object.values(EligibilityStatus) as string[]).includes(status);
}

/**
 * Type guard for run status.
 */
export function isValidRunStatus(status: unknown): status is RunStatusType {
  if (typeof status !== 'string') return false;
  return (Object.values(RunStatus) as string[]).includes(status);
}
