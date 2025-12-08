import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StatsController } from './presentation/controllers/stats.controller';
import { StatsService } from './application/services/stats.service';
import { StatsWorker } from './application/workers/stats.worker';
import { DrizzleStatsRepository } from './infrastructure/repositories/drizzle-stats.repository';
import { STATS_REPOSITORY } from './domain/repositories/stats.repository.interface';
import { CatalogModule } from '../catalog/catalog.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { ScoreCalculatorModule } from '../shared/score-calculator';
import { STATS_QUEUE } from './stats.constants';

/**
 * Stats Module.
 * Handles real-time media statistics like watchers count and trending metrics.
 * Uses BullMQ for background processing of stats sync jobs.
 * Depends on CatalogModule for media lookups and IngestionModule for Trakt API access.
 */
@Module({
  imports: [
    CatalogModule,
    IngestionModule,
    ScoreCalculatorModule,
    BullModule.registerQueue({
      name: STATS_QUEUE,
    }),
  ],
  controllers: [StatsController],
  providers: [
    StatsService,
    StatsWorker,
    {
      provide: STATS_REPOSITORY,
      useClass: DrizzleStatsRepository,
    },
  ],
  exports: [StatsService, STATS_REPOSITORY],
})
export class StatsModule {}
