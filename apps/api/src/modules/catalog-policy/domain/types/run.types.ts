/**
 * Run Types
 *
 * Domain types for evaluation run aggregation and finalization.
 */

/**
 * Aggregated counters from evaluations table.
 * Derived from COUNT(DISTINCT media_item_id) with FILTER conditions.
 *
 * Invariant: processed = eligible + ineligible + review
 * (errors are tracked separately in run's errors column)
 */
export interface AggregatedCounters {
  processed: number;
  eligible: number;
  ineligible: number;
  review: number;
  errors: number;
}

/**
 * Result of a run finalization attempt.
 * Contains status, reason, and optional counters for debugging.
 */
export interface FinalizeResult {
  runId: string;
  finalized: boolean;
  reason: string;
  counters?: AggregatedCounters & { total: number };
}

/**
 * Anomaly detected during run finalization.
 * Recorded in errorSample for later analysis.
 */
export interface RunAnomaly {
  type: 'ANOMALY_PROCESSED_GT_TOTAL';
  processed: number;
  total: number;
  timestamp: string;
}
