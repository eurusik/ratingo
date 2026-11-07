import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SECONDS_PER_DAY } from '@/common/constants';
import { apiOnly, workerOnly } from '@/common/runtime/app-role';
import mdblistConfig from '@/config/mdblist.config';
import omdbConfig from '@/config/omdb.config';
import schedulerConfig from '@/config/scheduler.config';
import tvmazeConfig from '@/config/tvmaze.config';
import webRevalidationConfig from '@/config/web-revalidation.config';

import { CatalogModule } from '../catalog/catalog.module';
import { CatalogPolicyModule } from '../catalog-policy/catalog-policy.module';
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
import { NewReleasesPipeline } from './application/pipelines/new-releases.pipeline';
import { NowPlayingPipeline } from './application/pipelines/now-playing.pipeline';
import { SnapshotsPipeline } from './application/pipelines/snapshots.pipeline';
import { TrackedShowsPipeline } from './application/pipelines/tracked-shows.pipeline';
import { TrendingPipeline } from './application/pipelines/trending.pipeline';
import { BulkJobService } from './application/services/bulk-job.service';
import { IngestionJobStatusService } from './application/services/ingestion-job-status.service';
import { IngestionSchedulerService } from './application/services/ingestion-scheduler.service';
import { MediaPageCacheService } from './application/services/media-page-cache.service';
import { SnapshotsService } from './application/services/snapshots.service';
import { SyncMediaService } from './application/services/sync-media.service';
import { TrackedSyncService } from './application/services/tracked-sync.service';
import { TvMazeEnrichmentService } from './application/services/tvmaze-enrichment.service';
import { BackfillWorker } from './application/workers/backfill.worker';
import { RatingsBackfillWorker } from './application/workers/ratings-backfill.worker';
import { SyncWorker } from './application/workers/sync.worker';
import { AGGREGATED_RATINGS_PORT } from './domain/ports/aggregated-ratings.port';
import { EPISODE_SCHEDULE_PORT } from './domain/ports/episode-schedule.port';
import { INGESTION_JOB_STATUS_PORT } from './domain/ports/ingestion-job-status.port';
import { ROTTEN_TOMATOES_RATINGS_PORT } from './domain/ports/rotten-tomatoes-ratings.port';
import { WEB_PAGE_CACHE_PORT } from './domain/ports/web-page-cache.port';
import { ALT_TITLES_BACKFILL_REPOSITORY } from './domain/repositories/alt-titles-backfill.repository.interface';
import { IMDB_BACKFILL_REPOSITORY } from './domain/repositories/imdb-backfill.repository.interface';
import { ROTTEN_TOMATOES_BACKFILL_REPOSITORY } from './domain/repositories/rotten-tomatoes-backfill.repository.interface';
import { SNAPSHOTS_REPOSITORY } from './domain/repositories/snapshots.repository.interface';
import { TRACKED_SHOW_REPOSITORY } from './domain/repositories/tracked-show.repository.interface';
import { BullMqIngestionJobStatusAdapter } from './infrastructure/adapters/job-status/bullmq-ingestion-job-status.adapter';
import { MdblistAdapter } from './infrastructure/adapters/mdblist/mdblist.adapter';
import { OmdbAdapter } from './infrastructure/adapters/omdb/omdb.adapter';
import { TvMazeAdapter } from './infrastructure/adapters/tvmaze/tvmaze.adapter';
import { NextRevalidateAdapter } from './infrastructure/adapters/web-page-cache/next-revalidate.adapter';
import { AltTitlesBackfillRepository } from './infrastructure/repositories/alt-titles-backfill.repository';
import { ImdbBackfillRepository } from './infrastructure/repositories/imdb-backfill.repository';
import { RottenTomatoesBackfillRepository } from './infrastructure/repositories/rotten-tomatoes-backfill.repository';
import { SnapshotsRepository } from './infrastructure/repositories/snapshots.repository';
import { TrackedShowRepository } from './infrastructure/repositories/tracked-show.repository';
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
    ConfigModule.forFeature(webRevalidationConfig),
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
        removeOnFail: { age: SECONDS_PER_DAY, count: 500 },
      },
    }),
  ],
  controllers: apiOnly(IngestionController),
  providers: [
    // Repository bindings
    {
      provide: SNAPSHOTS_REPOSITORY,
      useClass: SnapshotsRepository,
    },
    {
      provide: ROTTEN_TOMATOES_BACKFILL_REPOSITORY,
      useClass: RottenTomatoesBackfillRepository,
    },
    {
      provide: ALT_TITLES_BACKFILL_REPOSITORY,
      useClass: AltTitlesBackfillRepository,
    },
    {
      provide: IMDB_BACKFILL_REPOSITORY,
      useClass: ImdbBackfillRepository,
    },
    {
      provide: TRACKED_SHOW_REPOSITORY,
      useClass: TrackedShowRepository,
    },
    {
      provide: WEB_PAGE_CACHE_PORT,
      useClass: NextRevalidateAdapter,
    },
    {
      provide: INGESTION_JOB_STATUS_PORT,
      useClass: BullMqIngestionJobStatusAdapter,
    },
    MediaPageCacheService,
    {
      provide: AGGREGATED_RATINGS_PORT,
      useClass: OmdbAdapter,
    },
    {
      provide: ROTTEN_TOMATOES_RATINGS_PORT,
      useClass: MdblistAdapter,
    },
    {
      provide: EPISODE_SCHEDULE_PORT,
      useClass: TvMazeAdapter,
    },
    TvMazeEnrichmentService,
    BulkJobService,
    SyncMediaService,
    IngestionJobStatusService,
    TrackedSyncService,
    SnapshotsService,
    ...workerOnly(SyncWorker, BackfillWorker, RatingsBackfillWorker, IngestionSchedulerService),
    // Pipeline classes
    SnapshotsPipeline,
    TrendingPipeline,
    TrackedShowsPipeline,
    NowPlayingPipeline,
    NewReleasesPipeline,
    BackfillImdbPipeline,
    BackfillAltTitlesPipeline,
    BackfillMdblistRatingsPipeline,
  ],
  exports: [SyncMediaService, SnapshotsService],
})
export class IngestionModule {}
