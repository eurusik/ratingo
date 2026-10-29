import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { type AppRole, runsHttp } from './common/runtime/app-role';
import { ENV_FILE_PATHS } from './common/runtime/env-files';
import authConfig from './config/auth.config';
import { buildEnvSchema } from './config/env.schema';
import omdbConfig from './config/omdb.config';
import tmdbConfig from './config/tmdb.config';
import traktConfig from './config/trakt.config';
import { DatabaseModule } from './database/database.module';
import { ClockModule } from './modules/shared/clock';

const DEFAULT_REDIS_PORT = 6379;

const buildBullConnection = (config: ConfigService) => {
  const redisUrl = config.get<string>('REDIS_URL');
  if (redisUrl) {
    const url = new URL(redisUrl);
    const port = url.port ? Number(url.port) : DEFAULT_REDIS_PORT;
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    return {
      host: url.hostname,
      port,
      ...(password && { password }),
      ...(url.protocol === 'rediss:' && { tls: {} }),
    };
  }

  return {
    host: config.get('REDIS_HOST'),
    port: config.get('REDIS_PORT'),
  };
};

const httpConfigLoaders = (role: AppRole) => (runsHttp(role) ? [authConfig] : []);

export const buildAppCoreImports = (role: AppRole) => [
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
    useFactory: (config: ConfigService) => ({ connection: buildBullConnection(config) }),
  }),
  EventEmitterModule.forRoot(),
  DatabaseModule,
  ClockModule,
];
