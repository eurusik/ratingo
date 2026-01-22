import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { DropOffAnalyzerModule } from '../shared/drop-off-analyzer';
import { ScoreCalculatorModule } from '../shared/score-calculator';

import {
  DropOffService,
  ScoreRecalculationService,
  StatsBackfillService,
  StatsQueryService,
  TrendingSyncService,
} from './application/services';
import { StatsWorker } from './application/workers/stats.worker';
import { STATS_REPOSITORY } from './domain/repositories/stats.repository.interface';
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
    }),
  ],
  controllers: [StatsController],
  providers: [
    TrendingSyncService,
    ScoreRecalculationService,
    StatsBackfillService,
    StatsQueryService,
    DropOffService,
    StatsWorker,
    {
      provide: STATS_REPOSITORY,
      useClass: DrizzleStatsRepository,
    },
  ],
  exports: [TrendingSyncService, StatsQueryService, DropOffService, STATS_REPOSITORY],
})
export class StatsModule {}
