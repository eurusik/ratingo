/**
 * Diff Utilities
 *
 * Pure functions for comparing evaluation statuses between policy versions.
 */

import {
  EligibilityStatus,
  DIFF_STATUS_NONE,
  type DiffStatus,
} from '../constants/evaluation.constants';

/**
 * Checks if a status transition represents a regression (item leaving catalog).
 *
 * A regression occurs when an item was ELIGIBLE and becomes INELIGIBLE or is removed.
 *
 * @param oldStatus - Previous status (or 'none' if item didn't exist)
 * @param newStatus - New status (or 'none' if item was removed)
 * @returns true if this is a regression
 */
export function isDiffRegression(oldStatus: DiffStatus, newStatus: DiffStatus): boolean {
  return (
    oldStatus === EligibilityStatus.ELIGIBLE &&
    (newStatus === EligibilityStatus.INELIGIBLE || newStatus === DIFF_STATUS_NONE)
  );
}

/**
 * Checks if a status transition represents an improvement (item entering catalog).
 *
 * An improvement occurs when an item was INELIGIBLE or didn't exist
 * and becomes ELIGIBLE.
 *
 * @param oldStatus - Previous status (or 'none' if item didn't exist)
 * @param newStatus - New status (or 'none' if item was removed)
 * @returns true if this is an improvement
 */
export function isDiffImprovement(oldStatus: DiffStatus, newStatus: DiffStatus): boolean {
  return (
    (oldStatus === EligibilityStatus.INELIGIBLE || oldStatus === DIFF_STATUS_NONE) &&
    newStatus === EligibilityStatus.ELIGIBLE
  );
}
