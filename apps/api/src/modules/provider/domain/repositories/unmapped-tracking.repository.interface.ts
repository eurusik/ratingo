/**
 * Unmapped Tracking Repository Interface
 *
 * Port for tracking unmapped TMDB provider IDs.
 */

import type { UnmappedProvider } from '../types/provider.types';

export const UNMAPPED_TRACKING_REPOSITORY = Symbol('UNMAPPED_TRACKING_REPOSITORY');

/** Input for recording an unmapped provider encounter */
export interface RecordUnmappedInput {
  tmdbProviderId: number;
  providerName: string;
  region: string;
}

/** Options for querying unmapped providers */
export interface FindAllUnmappedOptions {
  sortBy?: 'count' | 'lastSeen';
  limit?: number;
}

/**
 * Repository for unmapped TMDB provider tracking.
 * Implemented by: UnmappedTrackingRepository
 */
export interface IUnmappedTrackingRepository {
  /**
   * Records a single unmapped provider encounter.
   * Creates new record or updates existing (increment count, update timestamps).
   */
  recordUnmapped(input: RecordUnmappedInput): Promise<void>;

  /**
   * Records multiple unmapped provider encounters in batch.
   * Handles deduplication and aggregation internally.
   */
  recordUnmappedBatch(inputs: RecordUnmappedInput[]): Promise<void>;

  /**
   * Finds all unmapped providers with optional sorting and limit.
   */
  findAll(options?: FindAllUnmappedOptions): Promise<UnmappedProvider[]>;

  /**
   * Finds unmapped provider by TMDB ID.
   */
  findByTmdbId(tmdbProviderId: number): Promise<UnmappedProvider | null>;

  /**
   * Removes unmapped provider record (called after mapping is created).
   */
  removeByTmdbId(tmdbProviderId: number): Promise<void>;
}
