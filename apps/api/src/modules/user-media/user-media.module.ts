import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { USER_MEDIA_STATE_REPOSITORY } from './domain/repositories/user-media-state.repository.interface';
import { DrizzleUserMediaStateRepository } from './infrastructure/repositories/drizzle-user-media-state.repository';
import { UserMediaService } from './application/user-media.service';
import { UserMediaController } from './presentation/controllers/user-media.controller';
import { MeListsController } from './presentation/controllers/me-lists.controller';
import { AuthModule } from '../auth/auth.module';
import { MeListsService } from './application/me-lists.service';

/**
 * User Media module wiring.
 */
@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
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
