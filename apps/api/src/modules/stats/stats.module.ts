import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StatsController } from './presentation/controllers/stats.controller';
import { StatsService } from './application/services/stats.service';
import { DropOffService } from './application/services/drop-off.service';
import { StatsWorker } from './application/workers/stats.worker';
import { DrizzleStatsRepository } from './infrastructure/repositories/drizzle-stats.repository';
import { STATS_REPOSITORY } from './domain/repositories/stats.repository.interface';
import { CatalogModule } from '../catalog/catalog.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { ScoreCalculatorModule } from '../shared/score-calculator';
import { DropOffAnalyzerModule } from '../shared/drop-off-analyzer';
import { STATS_QUEUE } from './stats.constants';

/**
 * Stats Module.
 * Handles real-time media statistics like watchers count, trending metrics, and drop-off analysis.
 * Uses BullMQ for background processing of stats sync and analysis jobs.
 */
@Module({
  imports: [
    CatalogModule,
    IngestionModule,
    ScoreCalculatorModule,
    DropOffAnalyzerModule,
    BullModule.registerQueue({
      name: STATS_QUEUE,
    }),
  ],
  controllers: [StatsController],
  providers: [
    StatsService,
    DropOffService,
    StatsWorker,
    {
      provide: STATS_REPOSITORY,
      useClass: DrizzleStatsRepository,
    },
  ],
  exports: [StatsService, DropOffService, STATS_REPOSITORY],
})
export class StatsModule {}
