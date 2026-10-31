import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { UserMediaModule } from '../user-media/user-media.module';

import { AvatarUploadService } from './application/avatar-upload.service';
import { PublicUserMediaService } from './application/public-user-media.service';
import { UsersService } from './application/users.service';
import { USERS_REPOSITORY } from './domain/repositories/users.repository.interface';
import { OBJECT_STORAGE_SERVICE } from './domain/services/object-storage.service.interface';
import { DrizzleUsersRepository } from './infrastructure/repositories/drizzle-users.repository';
import { S3ObjectStorageService } from './infrastructure/storage/s3-object-storage.service';
import { PublicUsersController } from './presentation/controllers/public-users.controller';
import { UsersController } from './presentation/controllers/users.controller';

/**
 * Wires Users domain and application services.
 */
@Module({
  imports: [DatabaseModule, UserMediaModule],
  providers: [
    UsersService,
    PublicUserMediaService,
    AvatarUploadService,
    {
      provide: OBJECT_STORAGE_SERVICE,
      useClass: S3ObjectStorageService,
    },
    {
      provide: USERS_REPOSITORY,
      useClass: DrizzleUsersRepository,
    },
  ],
  controllers: [UsersController, PublicUsersController],
  exports: [UsersService, USERS_REPOSITORY],
})
export class UsersModule {}
