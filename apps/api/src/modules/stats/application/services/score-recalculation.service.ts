import { Inject, Injectable, Logger } from '@nestjs/common';

import { type IMediaRepository, MEDIA_REPOSITORY } from '../../../catalog/public';
import { ScoreCalculatorService } from '../../../shared/score-calculator';
import {
  type IStatsRepository,
  type MediaStatsData,
  STATS_REPOSITORY,
} from '../../domain/repositories/stats.repository.interface';
import { type RecalculateScoresOptions } from '../../domain/types/stats.types';
import { toScoreInput } from '../helpers';

/**
 * Service for recalculating media scores.
 */
@Injectable()
export class ScoreRecalculationService {
  private readonly logger = new Logger(ScoreRecalculationService.name);

  constructor(
    private readonly scoreCalculator: ScoreCalculatorService,

    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,

    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Recalculates scores for all media items.
   * Uses pagination to process items in batches.
   *
   * @param options - Recalculation options
   * @param options.type - Filter by media type (movie/show)
   * @param options.batchSize - Number of items per batch
   * @returns Total count of recalculated items
   */
  async recalculateScores(options: RecalculateScoresOptions): Promise<{ total: number }> {
    const batchSize = options.batchSize ?? 100;
    let offset = 0;
    let total = 0;

    this.logger.log(
      `Starting score recalculation (type: ${options.type ?? 'all'}, batchSize: ${batchSize})...`,
    );

    let ids = await this.mediaRepository.findIdsForRecalculation({
      type: options.type,
      limit: batchSize,
      offset,
    });

    while (ids.length > 0) {
      const scoreDataList = await this.mediaRepository.findManyForScoring(ids);

      const statsToUpsert: MediaStatsData[] = [];

      for (const scoreData of scoreDataList) {
        const scores = this.scoreCalculator.calculate(toScoreInput(scoreData));

        statsToUpsert.push({
          mediaItemId: scoreData.id,
          ratingoScore: scores.ratingoScore,
          qualityScore: scores.qualityScore,
          popularityScore: scores.popularityScore,
          freshnessScore: scores.freshnessScore,
        });
      }

      if (statsToUpsert.length > 0) {
        await this.statsRepository.bulkUpsert(statsToUpsert);
      }

      total += statsToUpsert.length;
      offset += batchSize;

      this.logger.log(`Recalculated ${total} items...`);

      ids = await this.mediaRepository.findIdsForRecalculation({
        type: options.type,
        limit: batchSize,
        offset,
      });
    }

    this.logger.log(`Score recalculation complete: ${total} items updated`);
    return { total };
  }
}
