/**
 * Catalog Evaluation Run Repository Interface
 *
 * Manages evaluation run persistence and progress tracking.
 * Supports two-phase policy activation flow (Prepare → Promote).
 */

import { type RunStatusType } from '../constants/evaluation.constants';
import { type AggregatedCounters, type RunAnomaly } from '../types';

export const CATALOG_EVALUATION_RUN_REPOSITORY = Symbol('CATALOG_EVALUATION_RUN_REPOSITORY');

/** Represents an evaluation run with progress counters and metadata. */
export interface CatalogEvaluationRun {
  id: string;
  policyVersion: number;
  status: RunStatusType;
  startedAt: Date;
  finishedAt: Date | null;
  cursor: string | null;
  targetPolicyId: string | null;
  targetPolicyVersion: number | null;
  /** Version of active policy when run was created (for diff calculation). */
  baselinePolicyVersion: number | null;
  totalReadySnapshot: number;
  snapshotCutoff: Date | null;
  processed: number;
  eligible: number;
  ineligible: number;
  errors: number;
  errorSample: ErrorSample[];
  promotedAt: Date | null;
  promotedBy: string | null;
}

/** Error sample captured during evaluation. */
export interface ErrorSample {
  mediaItemId: string;
  error: string;
  stack?: string;
  timestamp: string;
}

export interface CreateRunInput {
  targetPolicyId: string;
  targetPolicyVersion: number;
  baselinePolicyVersion: number | null;
  totalReadySnapshot: number;
  snapshotCutoff: Date;
}

export interface UpdateRunInput {
  status?: RunStatusType;
  finishedAt?: Date;
  cursor?: string;
  processed?: number;
  eligible?: number;
  ineligible?: number;
  errors?: number;
  errorSample?: ErrorSample[];
  promotedAt?: Date;
  promotedBy?: string;
}

export interface IncrementCountersInput {
  processed?: number;
  eligible?: number;
  ineligible?: number;
  errors?: number;
}

export interface ICatalogEvaluationRunRepository {
  /** Creates a new evaluation run. */
  create(input: CreateRunInput): Promise<CatalogEvaluationRun>;

  /** Finds a run by ID. */
  findById(id: string): Promise<CatalogEvaluationRun | null>;

  /** Updates run fields. */
  update(id: string, updates: UpdateRunInput): Promise<void>;

  /** Atomically increments counters (prevents race conditions). */
  incrementCounters(id: string, increments: IncrementCountersInput): Promise<void>;

  /** Records error atomically: increments counter AND appends to sample. */
  recordError(id: string, error: ErrorSample): Promise<void>;

  /** Finds runs by target policy ID, ordered by startedAt desc. */
  findByPolicyId(policyId: string): Promise<CatalogEvaluationRun[]>;

  /** Finds runs by status, ordered by startedAt desc. */
  findByStatus(status: string): Promise<CatalogEvaluationRun[]>;

  /** Returns all runs with pagination, ordered by startedAt desc. */
  findAll(options?: { limit?: number; offset?: number }): Promise<CatalogEvaluationRun[]>;

  /**
   * Aggregates counters from evaluations table for a specific run.
   * Uses COUNT(DISTINCT media_item_id) to avoid double-counting.
   */
  aggregateCounters(runId: string): Promise<AggregatedCounters>;

  /**
   * Syncs cached counters with actual aggregated values.
   * Aggregates from evaluations table and updates the run.
   */
  syncRunCounters(runId: string): Promise<AggregatedCounters>;

  /**
   * Finds runs that are RUNNING and started before the cutoff date.
   * Used to detect stale runs that may need finalization.
   */
  findStaleRunning(cutoff: Date): Promise<Array<{ id: string }>>;

  /**
   * Records an anomaly in the run's errorSample.
   * Used for tracking issues like processed > total.
   */
  recordAnomaly(runId: string, anomaly: RunAnomaly): Promise<void>;

  /**
   * Atomically transitions a run from RUNNING to PREPARED.
   * Uses WHERE guard to prevent race conditions.
   * @returns true if transition succeeded, false if already transitioned
   */
  transitionToPrepared(runId: string, counters: AggregatedCounters): Promise<boolean>;
}
