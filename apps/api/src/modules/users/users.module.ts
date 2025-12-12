import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { USERS_REPOSITORY } from './domain/repositories/users.repository.interface';
import { DrizzleUsersRepository } from './infrastructure/repositories/drizzle-users.repository';
import { UsersService } from './application/users.service';
import { UsersController } from './presentation/controllers/users.controller';
import { PublicUsersController } from './presentation/controllers/public-users.controller';
import { AuthModule } from '../auth/auth.module';
import { UserMediaModule } from '../user-media/user-media.module';
import { PublicUserMediaService } from './application/public-user-media.service';

/**
 * Users module (domain + application wiring).
 */
@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule), forwardRef(() => UserMediaModule)],
  providers: [
    UsersService,
    PublicUserMediaService,
    {
      provide: USERS_REPOSITORY,
      useClass: DrizzleUsersRepository,
    },
  ],
  controllers: [UsersController, PublicUsersController],
  exports: [UsersService, USERS_REPOSITORY],
})
export class UsersModule {}
