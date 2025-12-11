import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { USERS_REPOSITORY } from './domain/repositories/users.repository.interface';
import { DrizzleUsersRepository } from './infrastructure/repositories/drizzle-users.repository';
import { UsersService } from './application/users.service';
import { UsersController } from './presentation/controllers/users.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Users module (domain + application wiring).
 */
@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  providers: [
    UsersService,
    {
      provide: USERS_REPOSITORY,
      useClass: DrizzleUsersRepository,
    },
  ],
  controllers: [UsersController],
  exports: [UsersService, USERS_REPOSITORY],
})
export class UsersModule {}
