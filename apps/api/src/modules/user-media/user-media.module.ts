import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CardsModule } from '../shared/cards/cards.module';

import { MeListsService } from './application/me-lists.service';
import { UserMediaService } from './application/user-media.service';
import { USER_MEDIA_STATE_REPOSITORY } from './domain/repositories/user-media-state.repository.interface';
import { DrizzleUserMediaStateRepository } from './infrastructure/repositories/drizzle-user-media-state.repository';
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
    {
      provide: USER_MEDIA_STATE_REPOSITORY,
      useClass: DrizzleUserMediaStateRepository,
    },
  ],
  controllers: [UserMediaController, MeListsController],
  exports: [UserMediaService, USER_MEDIA_STATE_REPOSITORY],
})
export class UserMediaModule {}
