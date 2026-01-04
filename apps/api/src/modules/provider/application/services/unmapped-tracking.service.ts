/**
 * Unmapped Tracking Service
 *
 * Tracks and manages unmapped TMDB provider IDs for admin visibility.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  FindAllUnmappedOptions,
  FindAllUnmappedResult,
  IUnmappedTrackingRepository,
  RecordUnmappedInput,
  UNMAPPED_TRACKING_REPOSITORY,
} from '../../domain/repositories/unmapped-tracking.repository.interface';
import type { UnmappedProvider } from '../../domain/types/provider.types';

@Injectable()
export class UnmappedTrackingService {
  private readonly logger = new Logger(UnmappedTrackingService.name);

  constructor(
    @Inject(UNMAPPED_TRACKING_REPOSITORY)
    private readonly repository: IUnmappedTrackingRepository,
  ) {}

  /**
   * Records a single unmapped provider encounter.
   * Creates new record or increments seen_count for existing.
   */
  async recordUnmapped(input: RecordUnmappedInput): Promise<void> {
    await this.repository.recordUnmapped(input);
    this.logger.debug(
      `Recorded unmapped provider: tmdbId=${input.tmdbProviderId} name="${input.providerName}" region=${input.region}`,
    );
  }

  /**
   * Records multiple unmapped provider encounters in batch.
   * Aggregates by tmdbProviderId before persisting.
   */
  async recordUnmappedBatch(inputs: RecordUnmappedInput[]): Promise<void> {
    if (inputs.length === 0) return;

    await this.repository.recordUnmappedBatch(inputs);
    this.logger.debug(`Recorded ${inputs.length} unmapped provider encounters`);
  }

  /**
   * Finds all unmapped providers with optional sorting and limit.
   *
   * @param options.sortBy - Sort by 'seenCount' (default) or 'lastSeenAt'
   * @param options.limit - Maximum number of results
   * @param options.offset - Offset for pagination
   */
  async findAll(options?: FindAllUnmappedOptions): Promise<FindAllUnmappedResult> {
    return this.repository.findAll(options);
  }

  /**
   * Finds unmapped provider by TMDB ID.
   */
  async findByTmdbId(tmdbProviderId: number): Promise<UnmappedProvider | null> {
    return this.repository.findByTmdbId(tmdbProviderId);
  }

  /**
   * Removes unmapped provider record.
   * Called after a mapping is created for this TMDB ID.
   */
  async removeByTmdbId(tmdbProviderId: number): Promise<void> {
    await this.repository.removeByTmdbId(tmdbProviderId);
    this.logger.debug(`Removed unmapped provider: tmdbId=${tmdbProviderId}`);
  }
}
