import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import omdbConfig from '../../config/omdb.config';
import schedulerConfig from '../../config/scheduler.config';
import traktConfig from '../../config/trakt.config';
import tvmazeConfig from '../../config/tvmaze.config';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogPolicyModule } from '../catalog-policy/catalog-policy.module';
import { ProviderModule } from '../provider/public';
import { ScoreCalculatorModule } from '../shared/score-calculator';
import { StatsModule } from '../stats/stats.module';
import { TmdbModule } from '../tmdb/public';
import { UserActionsModule } from '../user-actions/user-actions.module';
import { UserMediaModule } from '../user-media/user-media.module';

import { BackfillAltTitlesPipeline } from './application/pipelines/backfill-alt-titles.pipeline';
import { BackfillImdbPipeline } from './application/pipelines/backfill-imdb.pipeline';
import { NewReleasesPipeline } from './application/pipelines/new-releases.pipeline';
import { NowPlayingPipeline } from './application/pipelines/now-playing.pipeline';
import { SnapshotsPipeline } from './application/pipelines/snapshots.pipeline';
import { TrackedShowsPipeline } from './application/pipelines/tracked-shows.pipeline';
import { TrendingPipeline } from './application/pipelines/trending.pipeline';
import { BulkJobService } from './application/services/bulk-job.service';
import { IngestionSchedulerService } from './application/services/ingestion-scheduler.service';
import { SnapshotsService } from './application/services/snapshots.service';
import { SyncMediaService } from './application/services/sync-media.service';
import { TrackedSyncService } from './application/services/tracked-sync.service';
import { TvMazeEnrichmentService } from './application/services/tvmaze-enrichment.service';
import { BackfillWorker } from './application/workers/backfill.worker';
import { SyncWorker } from './application/workers/sync.worker';
import { TRAKT_LISTS_PORT } from './domain/ports/trakt-lists.port';
import { TRAKT_RATINGS_PORT } from './domain/ports/trakt-ratings.port';
import { SNAPSHOTS_REPOSITORY } from './domain/repositories/snapshots.repository.interface';
import { OmdbAdapter } from './infrastructure/adapters/omdb/omdb.adapter';
import { TraktListsAdapter } from './infrastructure/adapters/trakt/trakt-lists.adapter';
import { TraktRatingsAdapter } from './infrastructure/adapters/trakt/trakt-ratings.adapter';
import { TvMazeAdapter } from './infrastructure/adapters/tvmaze/tvmaze.adapter';
import { SnapshotsRepository } from './infrastructure/repositories/snapshots.repository';
import {
  BACKFILL_QUEUE,
  DEFAULT_INGESTION_JOB_OPTIONS,
  INGESTION_QUEUE,
} from './ingestion.constants';
import { IngestionController } from './presentation/controllers/ingestion.controller';

/**
 * Ingestion module.
 */
@Module({
  imports: [
    CatalogModule,
    CatalogPolicyModule,
    ProviderModule,
    TmdbModule,
    forwardRef(() => StatsModule),
    forwardRef(() => UserActionsModule),
    forwardRef(() => UserMediaModule),
    ScoreCalculatorModule,
    ConfigModule.forFeature(traktConfig),
    ConfigModule.forFeature(omdbConfig),
    ConfigModule.forFeature(tvmazeConfig),
    ConfigModule.forFeature(schedulerConfig),
    BullModule.registerQueue({
      name: INGESTION_QUEUE,
      defaultJobOptions: DEFAULT_INGESTION_JOB_OPTIONS,
    }),
    BullModule.registerQueue({
      name: BACKFILL_QUEUE,
      defaultJobOptions: {
        ...DEFAULT_INGESTION_JOB_OPTIONS,
        removeOnComplete: { age: 3600, count: 1000 }, // higher for fast queue observability
      },
    }),
  ],
  controllers: [IngestionController],
  providers: [
    // Repository bindings
    {
      provide: SNAPSHOTS_REPOSITORY,
      useClass: SnapshotsRepository,
    },
    // Port bindings (DDD: domain ports -> infrastructure adapters)
    {
      provide: TRAKT_RATINGS_PORT,
      useClass: TraktRatingsAdapter,
    },
    {
      provide: TRAKT_LISTS_PORT,
      useClass: TraktListsAdapter,
    },
    // Adapters (still exported for internal use within ingestion module)
    TraktRatingsAdapter,
    TraktListsAdapter,
    OmdbAdapter,
    TvMazeAdapter,
    TvMazeEnrichmentService,
    BulkJobService,
    SyncMediaService,
    TrackedSyncService,
    SyncWorker,
    BackfillWorker,
    SnapshotsService,
    IngestionSchedulerService,
    // Pipeline classes
    SnapshotsPipeline,
    TrendingPipeline,
    TrackedShowsPipeline,
    NowPlayingPipeline,
    NewReleasesPipeline,
    BackfillImdbPipeline,
    BackfillAltTitlesPipeline,
  ],
  exports: [SyncMediaService, TRAKT_RATINGS_PORT, TRAKT_LISTS_PORT, SnapshotsService],
})
export class IngestionModule {}
