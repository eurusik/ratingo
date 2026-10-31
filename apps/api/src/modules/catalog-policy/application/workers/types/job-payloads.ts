/**
 * Job Payload Types for Catalog Policy Queue
 *
 * Shared interfaces for BullMQ job payloads.
 */

import { type EvaluationContextType } from '../../../domain/constants/evaluation.constants';

/**
 * Payload for RE_EVALUATE_ALL job.
 * Context is REQUIRED - missing context is a bug.
 */
export interface ReEvaluateAllPayload {
  runId: string;
  policyVersion: number;
  context: EvaluationContextType;
  batchSize?: number;
  cursor?: string;
  /**
   * When true, evaluates only items updated AFTER the run's snapshotCutoff (items synced
   * while the run was in progress). Dispatched after promotion so those items get a row
   * for the newly active policy version. The run is already terminal, so counters, cursor
   * and finalization are left untouched.
   */
  afterSnapshot?: boolean;
}

/**
 * Payload for EVALUATE_CATALOG_ITEM job.
 * Context is REQUIRED - missing context is a bug.
 */
export interface EvaluateCatalogItemPayload {
  runId: string;
  policyVersion: number;
  mediaItemId: string;
  context: EvaluationContextType;
}

/**
 * Retry information supplied by the worker for EVALUATE_CATALOG_ITEM jobs.
 */
export interface EvaluateItemAttemptInfo {
  /** True when BullMQ will not retry the job after this attempt fails. */
  isFinalAttempt: boolean;
}

/**
 * Error sample entry for recording evaluation failures.
 */
export interface ErrorSampleEntry {
  mediaItemId: string;
  error: string;
  stack?: string;
  timestamp: string;
}
