import { Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService, type ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';

import authConfig from '../../config/auth.config';
import facebookConfig from '../../config/facebook.config';
import googleConfig from '../../config/google.config';
import { DatabaseModule } from '../../database/database.module';
import { UserMediaModule } from '../user-media/user-media.module';
import { UsersModule } from '../users/users.module';

import { AuthService } from './application/auth.service';
import { OAuthService } from './application/oauth.service';
import { TokenService } from './application/token.service';
import { EXCHANGE_CODES_REPOSITORY } from './domain/repositories/exchange-codes.repository.interface';
import { OAUTH_ACCOUNTS_REPOSITORY } from './domain/repositories/oauth-accounts.repository.interface';
import { REFRESH_TOKENS_REPOSITORY } from './domain/repositories/refresh-tokens.repository.interface';
import { PASSWORD_HASHER } from './domain/services/password-hasher.interface';
import { BcryptPasswordHasher } from './infrastructure/adapters/bcrypt-password.hasher';
import { FacebookAuthGuard } from './infrastructure/guards/facebook-auth.guard';
import { GoogleAuthGuard } from './infrastructure/guards/google-auth.guard';
import { CleanupExchangeCodesJob } from './infrastructure/jobs/cleanup-exchange-codes.job';
import { DrizzleExchangeCodesRepository } from './infrastructure/repositories/drizzle-exchange-codes.repository';
import { DrizzleOAuthAccountsRepository } from './infrastructure/repositories/drizzle-oauth-accounts.repository';
import { DrizzleRefreshTokensRepository } from './infrastructure/repositories/drizzle-refresh-tokens.repository';
import { FacebookStrategy } from './infrastructure/strategies/facebook.strategy';
import { GoogleStrategy } from './infrastructure/strategies/google.strategy';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LocalStrategy } from './infrastructure/strategies/local.strategy';
import { AuthController } from './presentation/controllers/auth.controller';
import { OAuthExceptionFilter } from './presentation/filters/oauth-exception.filter';

/**
 * Conditionally provides GoogleStrategy only when Google OAuth is enabled.
 * This prevents Passport from throwing "clientID required" error when
 * Google OAuth credentials are not configured.
 */
const googleStrategyProvider: Provider = {
  provide: GoogleStrategy,
  useFactory: (config: ConfigType<typeof googleConfig>) => {
    if (!config.enabled) {
      // Return null when Google OAuth is disabled - no strategy registered
      return null;
    }
    // Instantiate GoogleStrategy with the injected config
    return new GoogleStrategy(config);
  },
  inject: [googleConfig.KEY],
};

/**
 * Conditionally provides FacebookStrategy only when Facebook OAuth is enabled.
 * This prevents Passport from throwing "clientID required" error when
 * Facebook OAuth credentials are not configured.
 */
const facebookStrategyProvider: Provider = {
  provide: FacebookStrategy,
  useFactory: (config: ConfigType<typeof facebookConfig>) => {
    if (!config.enabled) {
      // Return null when Facebook OAuth is disabled - no strategy registered
      return null;
    }
    // Instantiate FacebookStrategy with the injected config
    return new FacebookStrategy(config);
  },
  inject: [facebookConfig.KEY],
};

/**
 * Auth module wiring (tokens, hashing, refresh storage).
 */
@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    ConfigModule.forFeature(facebookConfig),
    ConfigModule.forFeature(googleConfig),
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(authConfig)],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.accessTokenSecret'),
        signOptions: { expiresIn: configService.get<string>('auth.accessTokenTtl') },
      }),
    }),
    UsersModule,
    UserMediaModule,
    DatabaseModule,
  ],
  providers: [
    AuthService,
    TokenService,
    OAuthService,
    JwtStrategy,
    LocalStrategy,
    googleStrategyProvider,
    GoogleAuthGuard,
    facebookStrategyProvider,
    FacebookAuthGuard,
    OAuthExceptionFilter,
    CleanupExchangeCodesJob,
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: REFRESH_TOKENS_REPOSITORY,
      useClass: DrizzleRefreshTokensRepository,
    },
    {
      provide: EXCHANGE_CODES_REPOSITORY,
      useClass: DrizzleExchangeCodesRepository,
    },
    {
      provide: OAUTH_ACCOUNTS_REPOSITORY,
      useClass: DrizzleOAuthAccountsRepository,
    },
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    TokenService,
    OAuthService,
    PASSWORD_HASHER,
    REFRESH_TOKENS_REPOSITORY,
    EXCHANGE_CODES_REPOSITORY,
  ],
})
export class AuthModule {}
