import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import mdblistConfig from '../../config/mdblist.config';
import omdbConfig from '../../config/omdb.config';
import schedulerConfig from '../../config/scheduler.config';
import tvmazeConfig from '../../config/tvmaze.config';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogPolicyModule } from '../catalog-policy/catalog-policy.module';
import { PersonModule } from '../person/person.module';
import { ProviderModule } from '../provider/provider.module';
import { ScoreCalculatorModule } from '../shared/score-calculator/score-calculator.module';
import { StatsModule } from '../stats/stats.module';
import { TmdbModule } from '../tmdb/tmdb.module';
import { TraktModule } from '../trakt/trakt.module';
import { UserActionsModule } from '../user-actions/user-actions.module';
import { UserMediaModule } from '../user-media/user-media.module';

import { BackfillAltTitlesPipeline } from './application/pipelines/backfill-alt-titles.pipeline';
import { BackfillImdbPipeline } from './application/pipelines/backfill-imdb.pipeline';
import { BackfillMdblistRatingsPipeline } from './application/pipelines/backfill-mdblist-ratings.pipeline';
import { BackfillPersonCreditsPipeline } from './application/pipelines/backfill-person-credits.pipeline';
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
import { RatingsBackfillWorker } from './application/workers/ratings-backfill.worker';
import { SyncWorker } from './application/workers/sync.worker';
import { SNAPSHOTS_REPOSITORY } from './domain/repositories/snapshots.repository.interface';
import { MdblistAdapter } from './infrastructure/adapters/mdblist/mdblist.adapter';
import { OmdbAdapter } from './infrastructure/adapters/omdb/omdb.adapter';
import { TvMazeAdapter } from './infrastructure/adapters/tvmaze/tvmaze.adapter';
import { SnapshotsRepository } from './infrastructure/repositories/snapshots.repository';
import {
  BACKFILL_QUEUE,
  DEFAULT_INGESTION_JOB_OPTIONS,
  INGESTION_QUEUE,
  RATINGS_BACKFILL_QUEUE,
} from './ingestion.constants';
import { IngestionController } from './presentation/controllers/ingestion.controller';

/**
 * Ingestion module.
 */
@Module({
  imports: [
    CatalogModule,
    CatalogPolicyModule,
    PersonModule,
    ProviderModule,
    TmdbModule,
    TraktModule,
    StatsModule,
    UserActionsModule,
    UserMediaModule,
    ScoreCalculatorModule,
    ConfigModule.forFeature(omdbConfig),
    ConfigModule.forFeature(mdblistConfig),
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
    BullModule.registerQueue({
      name: RATINGS_BACKFILL_QUEUE,
      defaultJobOptions: {
        ...DEFAULT_INGESTION_JOB_OPTIONS,
        // Keep failed jobs longer to diagnose quota/429 issues after overnight drains.
        removeOnFail: { age: 24 * 3600, count: 500 },
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
    OmdbAdapter,
    MdblistAdapter,
    TvMazeAdapter,
    TvMazeEnrichmentService,
    BulkJobService,
    SyncMediaService,
    TrackedSyncService,
    SyncWorker,
    BackfillWorker,
    RatingsBackfillWorker,
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
    BackfillMdblistRatingsPipeline,
    BackfillPersonCreditsPipeline,
  ],
  exports: [SyncMediaService, SnapshotsService],
})
export class IngestionModule {}
