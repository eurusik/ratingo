import { Module, forwardRef } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { StatsModule } from '../stats/stats.module';
import { TmdbAdapter } from './infrastructure/adapters/tmdb/tmdb.adapter';
import { TraktAdapter } from './infrastructure/adapters/trakt/trakt.adapter';
import { OmdbAdapter } from './infrastructure/adapters/omdb/omdb.adapter';
import { SyncMediaService } from './application/services/sync-media.service';
import { ConfigModule } from '@nestjs/config';
import tmdbConfig from '../../config/tmdb.config';
import traktConfig from '../../config/trakt.config';
import omdbConfig from '../../config/omdb.config';
import { BullModule } from '@nestjs/bullmq';
import { SyncWorker } from './application/workers/sync.worker';
import { IngestionController } from './presentation/controllers/ingestion.controller';
import { ScoreCalculatorModule } from '../shared/score-calculator';

import { INGESTION_QUEUE } from './ingestion.constants';

@Module({
  imports: [
    CatalogModule,
    forwardRef(() => StatsModule),
    ScoreCalculatorModule,
    ConfigModule.forFeature(tmdbConfig),
    ConfigModule.forFeature(traktConfig),
    ConfigModule.forFeature(omdbConfig),
    BullModule.registerQueue({
      name: INGESTION_QUEUE,
    }),
  ],
  controllers: [IngestionController],
  providers: [TmdbAdapter, TraktAdapter, OmdbAdapter, SyncMediaService, SyncWorker],
  exports: [SyncMediaService, TraktAdapter],
})
export class IngestionModule {}
