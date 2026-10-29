import { Inject, Injectable } from '@nestjs/common';

import { MediaType } from '@/common/enums/media-type.enum';
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
   * @param {MediaType} type - Optional media type (movie/show TMDB ids overlap)
   * @returns {Promise<import('../../domain/repositories/stats.repository.interface').MediaStatsData>} Stats data
   * @throws {StatsNotFoundException} If stats not found
   */
  async getStatsByTmdbId(tmdbId: number, type?: MediaType) {
    const stats = await this.statsRepository.findByTmdbId(tmdbId, type);
    if (!stats) {
      throw new StatsNotFoundException(tmdbId, 'tmdbId');
    }
    return stats;
  }
}
