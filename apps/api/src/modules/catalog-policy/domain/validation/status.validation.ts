/**
 * Status Validation Functions
 *
 * Implements fail-fast principle for eligibility status validation.
 */

import {
  EligibilityStatus,
  EligibilityStatusType,
  RunStatus,
  RunStatusType,
} from '../constants/evaluation.constants';
import { InvalidEligibilityStatusError } from '../errors/policy.errors';

/**
 * Validates status is canonical eligibility value.
 *
 * @param status - Status value to validate
 * @returns Validated status as EligibilityStatusType
 * @throws {InvalidEligibilityStatusError} If status is not valid
 *
 * @example
 * validateStatus('eligible');  // Returns 'eligible'
 * validateStatus('ELIGIBLE');  // Throws InvalidEligibilityStatusError
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
 *
 * @param status - Value to check
 * @returns True if status is valid EligibilityStatusType
 */
export function isValidEligibilityStatus(status: unknown): status is EligibilityStatusType {
  if (typeof status !== 'string') {
    return false;
  }
  const validStatuses = Object.values(EligibilityStatus) as string[];
  return validStatuses.includes(status);
}

/**
 * Type guard for run status.
 *
 * @param status - Value to check
 * @returns True if status is valid RunStatusType
 */
export function isValidRunStatus(status: unknown): status is RunStatusType {
  if (typeof status !== 'string') {
    return false;
  }
  const validStatuses = Object.values(RunStatus) as string[];
  return validStatuses.includes(status);
}
