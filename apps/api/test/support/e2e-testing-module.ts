import type { ModuleMetadata } from '@nestjs/common';
import type { ConfigFactory } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing';

import authConfig from '../../src/config/auth.config';
import { DATABASE_CONNECTION, POSTGRES_CLIENT } from '../../src/database/database.module';
import { configureHttpApp, createHttpAdapter } from '../../src/http-app.setup';
import { ClockModule } from '../../src/modules/shared/clock';
import { replaceRedisWithStubs } from '../../src/offline-redis';

import { InMemoryQueue } from './in-memory-queue';

const buildE2eCoreImports = (extraConfigLoaders: ConfigFactory[]) => [
  ConfigModule.forRoot({
    isGlobal: true,
    load: [authConfig, ...extraConfigLoaders],
    ignoreEnvFile: true,
  }),
  EventEmitterModule.forRoot(),
  ClockModule,
];

export const createE2eTestingModule = (
  { imports = [], ...metadata }: ModuleMetadata,
  extraConfigLoaders: ConfigFactory[] = [],
): TestingModuleBuilder =>
  replaceRedisWithStubs(
    Test.createTestingModule({
      ...metadata,
      imports: [...buildE2eCoreImports(extraConfigLoaders), ...imports],
    })
      .overrideProvider(POSTGRES_CLIENT)
      .useValue({})
      .overrideProvider(DATABASE_CONNECTION)
      .useValue({}),
    (queueName) => new InMemoryQueue(queueName),
  );

export const createE2eApp = async (
  moduleFixture: TestingModule,
): Promise<NestFastifyApplication> => {
  const app = moduleFixture.createNestApplication<NestFastifyApplication>(createHttpAdapter());
  await configureHttpApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
};
