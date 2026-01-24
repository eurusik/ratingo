/**
 * Policy Input Repository Interface (Port)
 *
 * Domain port for fetching policy engine input data.
 * Implementation in infrastructure layer.
 */

import { type PolicyEngineInput } from '../types/policy.types';

/** DI token for IPolicyInputRepository */
export const POLICY_INPUT_REPOSITORY = Symbol('POLICY_INPUT_REPOSITORY');

/**
 * Options for fetching batch IDs for re-evaluation.
 */
export interface FetchBatchIdsOptions {
  /** Number of items to fetch per batch */
  batchSize: number;
  /** Cursor (last ID) for pagination */
  cursor?: string;
  /** Only fetch items updated before this date (snapshot cutoff) */
  snapshotCutoff?: Date;
}

/**
 * Repository port for fetching policy engine input data.
 *
 * Separates data access from policy evaluation logic.
 * Implementation lives in infrastructure layer.
 */
export interface IPolicyInputRepository {
  /**
   * Fetches PolicyEngineInput for a single media item.
   *
   * @param mediaItemId - Media item ID to fetch
   * @returns PolicyEngineInput or null if not found
   */
  findOneForEvaluation(mediaItemId: string): Promise<PolicyEngineInput | null>;

  /**
   * Fetches PolicyEngineInputs for multiple media items (batch).
   *
   * @param mediaItemIds - Array of media item IDs
   * @returns Array of PolicyEngineInput (may be fewer if some not found)
   */
  findManyForEvaluation(mediaItemIds: string[]): Promise<PolicyEngineInput[]>;

  /**
   * Counts total eligible items for evaluation.
   * Used for progress tracking in re-evaluation jobs.
   *
   * @returns Total count of media items eligible for evaluation
   */
  countEligibleItems(): Promise<number>;

  /**
   * Fetches batch of media item IDs for re-evaluation.
   * Uses cursor-based pagination for efficient batch processing.
   *
   * @param options - Batch size and cursor for pagination
   * @returns Array of media item IDs
   */
  fetchBatchIds(options: FetchBatchIdsOptions): Promise<string[]>;
}
