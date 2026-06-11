import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import tmdbConfig from '../../config/tmdb.config';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import {
  BACKFILL_QUEUE,
  DEFAULT_INGESTION_JOB_OPTIONS,
  INGESTION_QUEUE,
} from '../ingestion/public';
import { CardsModule } from '../shared/cards/cards.module';
import { UserActionsModule } from '../user-actions/user-actions.module';

import { EpisodeProgressService } from './application/episode-progress.service';
import { ImportMediaService } from './application/import-media.service';
import { ImportPendingService } from './application/import-pending.service';
import { CaughtUpTransitionListener } from './application/listeners/caught-up-transition.listener';
import { LinkImportListener } from './application/listeners/link-import.listener';
import { MeListsService } from './application/me-lists.service';
import { ResolveImportDispatcherPipeline } from './application/pipelines/resolve-import-dispatcher.pipeline';
import { ResolveImportItemPipeline } from './application/pipelines/resolve-import-item.pipeline';
import { UserMediaService } from './application/user-media.service';
import { IMPORT_PENDING_REPOSITORY } from './domain/constants/import-pending.constants';
import { MEDIA_LOOKUP_PORT } from './domain/constants/import.constants';
import { RATING_SYNC_PORT } from './domain/ports/rating-sync.port';
import { SHOW_STATUS_PORT } from './domain/ports/show-status.port';
import { TMDB_RESOLVER } from './domain/ports/tmdb-resolver.port';
import { EPISODE_PROGRESS_REPOSITORY } from './domain/repositories/episode-progress.repository.interface';
import { USER_MEDIA_STATE_REPOSITORY } from './domain/repositories/user-media-state.repository.interface';
import { DrizzleMediaLookupAdapter } from './infrastructure/adapters/drizzle-media-lookup.adapter';
import { DrizzleShowStatusAdapter } from './infrastructure/adapters/drizzle-show-status.adapter';
import { TmdbResolverAdapter } from './infrastructure/adapters/tmdb-resolver.adapter';
import { DrizzleImportPendingRepository } from './infrastructure/drizzle-import-pending.repository';
import { FavoriteUpdatesQuery } from './infrastructure/queries/favorite-updates.query';
import { DrizzleEpisodeProgressRepository } from './infrastructure/repositories/drizzle-episode-progress.repository';
import { DrizzleUserMediaStateRepository } from './infrastructure/repositories/drizzle-user-media-state.repository';
import { EpisodeProgressController } from './presentation/controllers/episode-progress.controller';
import { MeListsController } from './presentation/controllers/me-lists.controller';
import { UserMediaController } from './presentation/controllers/user-media.controller';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => AuthModule),
    CardsModule,
    UserActionsModule,
    ConfigModule.forFeature(tmdbConfig),
    BullModule.registerQueue({
      name: BACKFILL_QUEUE,
      defaultJobOptions: {
        ...DEFAULT_INGESTION_JOB_OPTIONS,
        removeOnComplete: { age: 3600, count: 1000 },
      },
    }),
    BullModule.registerQueue({
      name: INGESTION_QUEUE,
      defaultJobOptions: DEFAULT_INGESTION_JOB_OPTIONS,
    }),
  ],
  providers: [
    UserMediaService,
    MeListsService,
    EpisodeProgressService,
    ImportMediaService,
    ImportPendingService,
    FavoriteUpdatesQuery,
    CaughtUpTransitionListener,
    LinkImportListener,
    ResolveImportDispatcherPipeline,
    ResolveImportItemPipeline,
    {
      provide: USER_MEDIA_STATE_REPOSITORY,
      useClass: DrizzleUserMediaStateRepository,
    },
    {
      provide: EPISODE_PROGRESS_REPOSITORY,
      useClass: DrizzleEpisodeProgressRepository,
    },
    {
      provide: RATING_SYNC_PORT,
      useExisting: UserMediaService,
    },
    {
      provide: MEDIA_LOOKUP_PORT,
      useClass: DrizzleMediaLookupAdapter,
    },
    {
      provide: IMPORT_PENDING_REPOSITORY,
      useClass: DrizzleImportPendingRepository,
    },
    {
      provide: TMDB_RESOLVER,
      useClass: TmdbResolverAdapter,
    },
    {
      provide: SHOW_STATUS_PORT,
      useClass: DrizzleShowStatusAdapter,
    },
  ],
  controllers: [UserMediaController, MeListsController, EpisodeProgressController],
  exports: [
    UserMediaService,
    RATING_SYNC_PORT,
    USER_MEDIA_STATE_REPOSITORY,
    EPISODE_PROGRESS_REPOSITORY,
    ImportPendingService,
    ResolveImportDispatcherPipeline,
    ResolveImportItemPipeline,
    IMPORT_PENDING_REPOSITORY,
    TMDB_RESOLVER,
  ],
})
export class UserMediaModule {}
