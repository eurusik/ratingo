import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { DropOffAnalyzerModule } from '../shared/drop-off-analyzer';
import { ScoreCalculatorModule } from '../shared/score-calculator';

import { CommunityRatingChangedListener } from './application/listeners/community-rating-changed.listener';
import {
  DropOffService,
  ScoreRecalculationService,
  StatsBackfillService,
  StatsQueryService,
  TrendingSyncService,
} from './application/services';
import { CommunityRatingService } from './application/services/community-rating.service';
import { StatsWorker } from './application/workers/stats.worker';
import { COMMUNITY_RATING_AGGREGATION_PORT } from './domain/ports/community-rating-aggregation.port';
import { STATS_REPOSITORY } from './domain/repositories/stats.repository.interface';
import { CommunityRatingAggregationQuery } from './infrastructure/queries/community-rating-aggregation.query';
import { DrizzleStatsRepository } from './infrastructure/repositories/drizzle-stats.repository';
import { StatsController } from './presentation/controllers/stats.controller';
import { STATS_QUEUE } from './stats.constants';

/**
 * Stats module.
 * Handles real-time media statistics like watchers count, trending metrics, and drop-off analysis.
 * Uses BullMQ for background processing of stats sync and analysis jobs.
 */
@Module({
  imports: [
    CatalogModule,
    forwardRef(() => IngestionModule),
    ScoreCalculatorModule,
    DropOffAnalyzerModule,
    BullModule.registerQueue({
      name: STATS_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 1000 }, // Keep max 1000 or 1 hour
        removeOnFail: { age: 86400, count: 500 }, // Keep max 500 or 24 hours
      },
    }),
  ],
  controllers: [StatsController],
  providers: [
    TrendingSyncService,
    ScoreRecalculationService,
    StatsBackfillService,
    StatsQueryService,
    DropOffService,
    CommunityRatingService,
    CommunityRatingChangedListener,
    StatsWorker,
    {
      provide: STATS_REPOSITORY,
      useClass: DrizzleStatsRepository,
    },
    {
      provide: COMMUNITY_RATING_AGGREGATION_PORT,
      useClass: CommunityRatingAggregationQuery,
    },
  ],
  exports: [TrendingSyncService, StatsQueryService, DropOffService, STATS_REPOSITORY],
})
export class StatsModule {}
