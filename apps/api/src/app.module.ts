import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';

import * as Joi from 'joi';

import { buildThrottlerTiers, ThrottlerRealIpGuard } from './common/guards/throttler-realip.guard';
import authConfig from './config/auth.config';
import omdbConfig from './config/omdb.config';
import tmdbConfig from './config/tmdb.config';
import traktConfig from './config/trakt.config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HomeModule } from './modules/home/home.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { InsightsModule } from './modules/insights/insights.module';
import { JournalModule } from './modules/journal/journal.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ClockModule } from './modules/shared/clock';
import { StatsModule } from './modules/stats/stats.module';
import { UserActionsModule } from './modules/user-actions/user-actions.module';
import { UserMediaModule } from './modules/user-media/user-media.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Duration format regex for TTL validation (e.g., 15m, 7d, 1h, 30s, 100ms).
 */
const DURATION_RE = /^\d+\s*(ms|s|m|h|d)$/i;

/**
 * Root application module.
 */
@Module({
  imports: [
    // Rate Limiting - Tiered protection
    // Method-based selection: GET=default, mutations=strict. The 'auth' and 'refresh' tiers are
    // skipped everywhere except routes that opt in via @Throttle({ auth|refresh: {...} })
    // (see buildThrottlerTiers). Do NOT override 'default' with @Throttle() on mutation routes:
    // its module-level skipIf would still skip it.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: buildThrottlerTiers(config.get('THROTTLE_LIMIT', 600)), // 600 req/min (10 rps)
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      load: [tmdbConfig, traktConfig, omdbConfig, authConfig],
      validationSchema: Joi.object({
        // Server
        PORT: Joi.number().default(3001),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

        // Database
        DATABASE_URL: Joi.string().required(),

        // Redis (BullMQ)
        REDIS_URL: Joi.string().uri().optional(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),

        // TMDB
        TMDB_API_KEY: Joi.string().required(),
        TMDB_API_URL: Joi.string().uri().default('https://api.themoviedb.org/3'),

        // Trakt
        TRAKT_CLIENT_ID: Joi.string().required(),
        TRAKT_CLIENT_SECRET: Joi.string().required(),

        // OMDb
        OMDB_API_KEY: Joi.string().required(),

        // MDBList (optional — used only for Rotten Tomatoes ratings backfill;
        // pipeline no-ops when key is absent)
        MDBLIST_API_KEY: Joi.string().optional(),
        MDBLIST_API_URL: Joi.string().uri().optional(),

        // Auth (REQUIRED for security)
        ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
        REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
        ACCESS_TOKEN_TTL: Joi.string().pattern(DURATION_RE).default('15m'),
        REFRESH_TOKEN_TTL: Joi.string().pattern(DURATION_RE).default('7d'),
        BCRYPT_SALT_ROUNDS: Joi.number().default(12),
        // OAuth state/exchange secrets: required in production (auth.config.ts only has dev fallbacks)
        OAUTH_STATE_SECRET: Joi.string()
          .min(32)
          .when('NODE_ENV', { is: 'production', then: Joi.required(), otherwise: Joi.optional() }),
        OAUTH_EXCHANGE_CODE_PEPPER: Joi.string()
          .min(32)
          .when('NODE_ENV', { is: 'production', then: Joi.required(), otherwise: Joi.optional() }),

        // Rate Limiting
        THROTTLE_LIMIT: Joi.number().default(600),
      }),
      validationOptions: {
        allowUnknown: true, // Allow other env vars
        abortEarly: true, // Stop on first error
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          const url = new URL(redisUrl);
          const port = url.port ? Number(url.port) : 6379;
          const password = url.password ? decodeURIComponent(url.password) : undefined;
          return {
            connection: {
              host: url.hostname,
              port,
              ...(password && { password }),
              ...(url.protocol === 'rediss:' && { tls: {} }),
            },
          };
        }

        return {
          connection: {
            host: config.get('REDIS_HOST'),
            port: config.get('REDIS_PORT'),
          },
        };
      },
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    ClockModule,
    CatalogModule,
    IngestionModule,
    StatsModule,
    HomeModule,
    InsightsModule,
    AuthModule,
    UsersModule,
    UserMediaModule,
    UserActionsModule,
    JournalModule,
    ReviewsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global rate limiting guard with real IP extraction (Cloudflare/proxy support)
    {
      provide: APP_GUARD,
      useClass: ThrottlerRealIpGuard,
    },
  ],
})
export class AppModule {}
