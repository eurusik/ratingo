import type { ModuleMetadata } from '@nestjs/common';
import type { ConfigFactory } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing';

import authConfig from '../../src/config/auth.config';
import { DATABASE_CONNECTION, POSTGRES_CLIENT } from '../../src/database/database.module';
import { configureHttpApp } from '../../src/http-app.setup';
import { ClockModule } from '../../src/modules/shared/clock';

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
  Test.createTestingModule({
    ...metadata,
    imports: [...buildE2eCoreImports(extraConfigLoaders), ...imports],
  })
    .overrideProvider(POSTGRES_CLIENT)
    .useValue({})
    .overrideProvider(DATABASE_CONNECTION)
    .useValue({});

export async function createE2eApp(moduleFixture: TestingModule): Promise<NestFastifyApplication> {
  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await configureHttpApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
