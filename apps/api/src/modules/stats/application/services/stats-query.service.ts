import { Inject, Injectable } from '@nestjs/common';

import { StatsNotFoundException } from '@/common/exceptions';

import {
  type IStatsRepository,
  STATS_REPOSITORY,
} from '../../domain/repositories/stats.repository.interface';

/**
 * Service for querying media statistics.
 */
@Injectable()
export class StatsQueryService {
  constructor(
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  /**
   * Gets stats for a media item by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID of the media item
   * @returns {Promise<import('../../domain/repositories/stats.repository.interface').MediaStatsData>} Stats data
   * @throws {StatsNotFoundException} If stats not found
   */
  async getStatsByTmdbId(tmdbId: number) {
    const stats = await this.statsRepository.findByTmdbId(tmdbId);
    if (!stats) {
      throw new StatsNotFoundException(tmdbId, 'tmdbId');
    }
    return stats;
  }
}
