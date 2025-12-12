import { Module, forwardRef } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { StatsModule } from '../stats/stats.module';
import { TmdbModule } from '../tmdb/tmdb.module';
import { TraktRatingsAdapter } from './infrastructure/adapters/trakt/trakt-ratings.adapter';
import { TraktListsAdapter } from './infrastructure/adapters/trakt/trakt-lists.adapter';
import { OmdbAdapter } from './infrastructure/adapters/omdb/omdb.adapter';
import { TvMazeAdapter } from './infrastructure/adapters/tvmaze/tvmaze.adapter';
import { SyncMediaService } from './application/services/sync-media.service';
import { ConfigModule } from '@nestjs/config';
import traktConfig from '../../config/trakt.config';
import { BullModule } from '@nestjs/bullmq';
import { INGESTION_QUEUE } from './ingestion.constants';
import { IngestionController } from './presentation/controllers/ingestion.controller';
import { ScoreCalculatorModule } from '../shared/score-calculator';
import { SnapshotsService } from './application/services/snapshots.service';
import omdbConfig from '../../config/omdb.config';
import { SyncWorker } from './application/workers/sync.worker';

@Module({
  imports: [
    CatalogModule,
    TmdbModule,
    forwardRef(() => StatsModule),
    ScoreCalculatorModule,
    ConfigModule.forFeature(traktConfig),
    ConfigModule.forFeature(omdbConfig),
    BullModule.registerQueue({
      name: INGESTION_QUEUE,
    }),
  ],
  controllers: [IngestionController],
  providers: [
    TraktRatingsAdapter,
    TraktListsAdapter,
    OmdbAdapter,
    TvMazeAdapter,
    SyncMediaService,
    SyncWorker,
    SnapshotsService,
  ],
  exports: [SyncMediaService, TraktRatingsAdapter, TraktListsAdapter, SnapshotsService],
})
export class IngestionModule {}
