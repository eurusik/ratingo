/**
 * Run Types
 *
 * Domain types for evaluation run aggregation and finalization.
 */

/**
 * Aggregated counters from evaluations table (item-level).
 *
 * An item counts as `processed` only when it has an evaluation for EVERY context the run
 * must cover (see resolveRunContextScope). Its eligible/ineligible/review bucket is taken
 * from the catalog context (falling back to any covered context), so each processed item
 * lands in exactly one bucket.
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
 * Aggregated counters plus evaluation-level progress used to decide run completion.
 */
export interface RunProgressCounters extends AggregatedCounters {
  /**
   * Number of completed (media_item_id, context) evaluations within the run's required contexts.
   * Compared against total * contextsPerItem; recorded errors count toward completion too.
   */
  evaluations: number;
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
