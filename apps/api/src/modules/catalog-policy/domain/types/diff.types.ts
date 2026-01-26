/**
 * Diff Types
 *
 * Domain types for policy diff comparisons.
 * Used to compute differences between policy versions.
 */

import { type DiffStatus } from '../constants/evaluation.constants';

/**
 * Default sample size for diff reports.
 */
export const DEFAULT_DIFF_SAMPLE_SIZE = 50;

/**
 * Aggregated counts of changes between policy versions.
 */
export interface DiffCounts {
  /** Items that will be removed from catalog (ELIGIBLE → INELIGIBLE) */
  regressions: number;
  /** Items that will be added to catalog (INELIGIBLE → ELIGIBLE) */
  improvements: number;
  /** Items that stay eligible */
  unchanged: number;
  /** Items that were and remain ineligible */
  stillIneligible: number;
}

/**
 * Breakdown of reasons for regressions and improvements.
 */
export interface ReasonBreakdown {
  /** Breakdown of regression reasons */
  regressionReasons: Record<string, number>;
  /** Breakdown of improvement reasons */
  improvementReasons: Record<string, number>;
}

/**
 * Sample item showing a specific change between policy versions.
 */
export interface DiffSample {
  mediaItemId: string;
  title: string | null;
  oldStatus: DiffStatus;
  newStatus: DiffStatus;
  trendingScore: number | null;
}

/**
 * Complete diff report between two policy versions.
 */
export interface DiffReport {
  runId: string;
  targetPolicyVersion: number;
  currentPolicyVersion: number | null;
  counts: DiffCounts;
  /** Top regressions by trendingScore (items leaving catalog) */
  topRegressions: DiffSample[];
  /** Top improvements by trendingScore (items entering catalog) */
  topImprovements: DiffSample[];
  /** Breakdown of reasons for regressions and improvements */
  reasonBreakdown?: ReasonBreakdown;
}
