import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import authConfig from '../../config/auth.config';
import { AuthService } from './application/auth.service';
import { UsersModule } from '../users/users.module';
import { PASSWORD_HASHER } from './domain/services/password-hasher.interface';
import { BcryptPasswordHasher } from './infrastructure/adapters/bcrypt-password.hasher';
import { REFRESH_TOKENS_REPOSITORY } from './domain/repositories/refresh-tokens.repository.interface';
import { DrizzleRefreshTokensRepository } from './infrastructure/repositories/drizzle-refresh-tokens.repository';
import { DatabaseModule } from '../../database/database.module';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LocalStrategy } from './infrastructure/strategies/local.strategy';
import { AuthController } from './presentation/controllers/auth.controller';
import { UserMediaModule } from '../user-media/user-media.module';

/**
 * Auth module wiring (tokens, hashing, refresh storage).
 */
@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(authConfig)],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.accessTokenSecret'),
        signOptions: { expiresIn: configService.get<string>('auth.accessTokenTtl') },
      }),
    }),
    forwardRef(() => UsersModule),
    forwardRef(() => UserMediaModule),
    DatabaseModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: REFRESH_TOKENS_REPOSITORY,
      useClass: DrizzleRefreshTokensRepository,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService, PASSWORD_HASHER, REFRESH_TOKENS_REPOSITORY],
})
export class AuthModule {}
