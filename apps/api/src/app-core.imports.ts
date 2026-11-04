import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { buildRedisConnectionOptions } from './common/infrastructure/redis/redis-connection';
import { type AppRole, getAppRole, runsHttp } from './common/runtime/app-role';
import { ENV_FILE_PATHS } from './common/runtime/env-files';
import authConfig from './config/auth.config';
import { buildEnvSchema } from './config/env.schema';
import omdbConfig from './config/omdb.config';
import tmdbConfig from './config/tmdb.config';
import traktConfig from './config/trakt.config';
import { DatabaseModule } from './database/database.module';
import { ClockModule } from './modules/shared/clock';
import { RuntimeMetricsModule } from './telemetry/runtime-metrics.module';

const httpConfigLoaders = (role: AppRole) => (runsHttp(role) ? [authConfig] : []);

export const buildAppCoreImports = (role: AppRole = getAppRole()) => [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ENV_FILE_PATHS,
    load: [tmdbConfig, traktConfig, omdbConfig, ...httpConfigLoaders(role)],
    validationSchema: buildEnvSchema(role),
    validationOptions: {
      allowUnknown: true,
      abortEarly: true,
    },
  }),
  BullModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({ connection: buildRedisConnectionOptions(config) }),
  }),
  EventEmitterModule.forRoot(),
  DatabaseModule,
  ClockModule,
  RuntimeMetricsModule,
];
