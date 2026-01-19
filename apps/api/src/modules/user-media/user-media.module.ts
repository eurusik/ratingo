import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CardsModule } from '../shared/cards/cards.module';

import { EpisodeProgressService } from './application/episode-progress.service';
import { MeListsService } from './application/me-lists.service';
import { UserMediaService } from './application/user-media.service';
import { EPISODE_PROGRESS_REPOSITORY } from './domain/repositories/episode-progress.repository.interface';
import { USER_MEDIA_STATE_REPOSITORY } from './domain/repositories/user-media-state.repository.interface';
import { DrizzleEpisodeProgressRepository } from './infrastructure/repositories/drizzle-episode-progress.repository';
import { DrizzleUserMediaStateRepository } from './infrastructure/repositories/drizzle-user-media-state.repository';
import { EpisodeProgressController } from './presentation/controllers/episode-progress.controller';
import { MeListsController } from './presentation/controllers/me-lists.controller';
import { UserMediaController } from './presentation/controllers/user-media.controller';

/**
 * User Media module wiring.
 */
@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule), CardsModule],
  providers: [
    UserMediaService,
    MeListsService,
    EpisodeProgressService,
    {
      provide: USER_MEDIA_STATE_REPOSITORY,
      useClass: DrizzleUserMediaStateRepository,
    },
    {
      provide: EPISODE_PROGRESS_REPOSITORY,
      useClass: DrizzleEpisodeProgressRepository,
    },
  ],
  controllers: [UserMediaController, MeListsController, EpisodeProgressController],
  exports: [UserMediaService, USER_MEDIA_STATE_REPOSITORY, EPISODE_PROGRESS_REPOSITORY],
})
export class UserMediaModule {}
