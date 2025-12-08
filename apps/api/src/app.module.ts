import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule } from './database/database.module';
import tmdbConfig from './config/tmdb.config';
import traktConfig from './config/trakt.config';
import omdbConfig from './config/omdb.config';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { StatsModule } from './modules/stats/stats.module';

import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      load: [tmdbConfig, traktConfig, omdbConfig],
      validationSchema: Joi.object({
        // Server
        PORT: Joi.number().default(3001),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),

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
      }),
      validationOptions: {
        allowUnknown: true, // Allow other env vars
        abortEarly: true,   // Stop on first error
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
