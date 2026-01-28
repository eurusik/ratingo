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
 * Error sample entry for recording evaluation failures.
 */
export interface ErrorSampleEntry {
  mediaItemId: string;
  error: string;
  stack?: string;
  timestamp: string;
}
