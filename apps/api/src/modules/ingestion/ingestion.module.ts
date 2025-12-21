import { Module, forwardRef } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { StatsModule } from '../stats/stats.module';
import { TmdbModule } from '../tmdb/tmdb.module';
import { UserActionsModule } from '../user-actions/user-actions.module';
import { TraktRatingsAdapter } from './infrastructure/adapters/trakt/trakt-ratings.adapter';
import { TraktListsAdapter } from './infrastructure/adapters/trakt/trakt-lists.adapter';
import { OmdbAdapter } from './infrastructure/adapters/omdb/omdb.adapter';
import { TvMazeAdapter } from './infrastructure/adapters/tvmaze/tvmaze.adapter';
import { SyncMediaService } from './application/services/sync-media.service';
import { TrackedSyncService } from './application/services/tracked-sync.service';
import { ConfigModule } from '@nestjs/config';
import traktConfig from '../../config/trakt.config';
import { BullModule } from '@nestjs/bullmq';
import { INGESTION_QUEUE } from './ingestion.constants';
import { IngestionController } from './presentation/controllers/ingestion.controller';
import { ScoreCalculatorModule } from '../shared/score-calculator';
import { SnapshotsService } from './application/services/snapshots.service';
import { IngestionSchedulerService } from './application/services/ingestion-scheduler.service';
import omdbConfig from '../../config/omdb.config';
import schedulerConfig from '../../config/scheduler.config';
import { SyncWorker } from './application/workers/sync.worker';
import { SnapshotsPipeline } from './application/pipelines/snapshots.pipeline';
import { TrendingPipeline } from './application/pipelines/trending.pipeline';
import { TrackedShowsPipeline } from './application/pipelines/tracked-shows.pipeline';
import { NowPlayingPipeline } from './application/pipelines/now-playing.pipeline';
import { NewReleasesPipeline } from './application/pipelines/new-releases.pipeline';

/**
 * Ingestion module.
 */
@Module({
  imports: [
    CatalogModule,
    TmdbModule,
    forwardRef(() => StatsModule),
    forwardRef(() => UserActionsModule),
    ScoreCalculatorModule,
    ConfigModule.forFeature(traktConfig),
    ConfigModule.forFeature(omdbConfig),
    ConfigModule.forFeature(schedulerConfig),
    BullModule.registerQueue({
      name: INGESTION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  controllers: [IngestionController],
  providers: [
    TraktRatingsAdapter,
    TraktListsAdapter,
    OmdbAdapter,
    TvMazeAdapter,
    SyncMediaService,
    TrackedSyncService,
    SyncWorker,
    SnapshotsService,
    IngestionSchedulerService,
    // Pipeline classes
    SnapshotsPipeline,
    TrendingPipeline,
    TrackedShowsPipeline,
    NowPlayingPipeline,
    NewReleasesPipeline,
  ],
  exports: [SyncMediaService, TraktRatingsAdapter, TraktListsAdapter, SnapshotsService],
})
export class IngestionModule {}
