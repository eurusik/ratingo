import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { DatabaseModule } from './database/database.module';
import tmdbConfig from './config/tmdb.config';
import traktConfig from './config/trakt.config';
import omdbConfig from './config/omdb.config';
import authConfig from './config/auth.config';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { StatsModule } from './modules/stats/stats.module';
import { HomeModule } from './modules/home/home.module';
import { InsightsModule } from './modules/insights/insights.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UserMediaModule } from './modules/user-media/user-media.module';
import { UserActionsModule } from './modules/user-actions/user-actions.module';
import { ThrottlerRealIpGuard } from './common/guards/throttler-realip.guard';

import { BullModule } from '@nestjs/bullmq';

/**
 * Duration format regex for TTL validation (e.g., 15m, 7d, 1h, 30s, 100ms).
 */
const DURATION_RE = /^\d+\s*(ms|s|m|h|d)$/i;

/**
 * Root application module.
 */
@Module({
  imports: [
    // Rate Limiting - Global protection against DDoS/brute-force
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('THROTTLE_TTL', 60000),
            limit: config.get('THROTTLE_LIMIT', 100),
          },
          {
            name: 'auth',
            ttl: 60000, // 1 minute
            limit: 5, // 5 attempts per minute for auth endpoints
          },
        ],
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

        // Auth (REQUIRED for security)
        ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
        REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
        ACCESS_TOKEN_TTL: Joi.string().pattern(DURATION_RE).default('15m'),
        REFRESH_TOKEN_TTL: Joi.string().pattern(DURATION_RE).default('7d'),
        BCRYPT_SALT_ROUNDS: Joi.number().default(12),

        // Rate Limiting
        THROTTLE_TTL: Joi.number().default(60000),
        THROTTLE_LIMIT: Joi.number().default(100),
      }),
      validationOptions: {
        allowUnknown: true, // Allow other env vars
        abortEarly: true, // Stop on first error
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
        },
      }),
    }),
    DatabaseModule,
    CatalogModule,
    IngestionModule,
    StatsModule,
    HomeModule,
    InsightsModule,
    AuthModule,
    UsersModule,
    UserMediaModule,
    UserActionsModule,
  ],
  controllers: [],
  providers: [
    // Global rate limiting guard with real IP extraction (Cloudflare/proxy support)
    {
      provide: APP_GUARD,
      useClass: ThrottlerRealIpGuard,
    },
  ],
})
export class AppModule {}
