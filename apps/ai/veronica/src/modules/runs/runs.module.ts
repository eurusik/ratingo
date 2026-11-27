import { type DynamicModule, Global, Module } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

import {
  InMemoryRunRepository,
  RUN_REPOSITORY,
  createRunRepository,
  type RunRepository,
} from '@ratingo/ai-core';

import { NestRunLogger } from '../../core/nest-run-logger';
import { DATABASE } from '../../database/database.constants';
import type { Database } from '../../database/database.module';
import { SERVICE_NAME } from '../../telemetry/telemetry.constants';

import { PostgresRunRepository } from './infrastructure/repositories/postgres.run-repository';

const withRunMetrics = (base: RunRepository): RunRepository =>
  createRunRepository({
    base,
    meter: metrics.getMeter(SERVICE_NAME),
    runLogger: new NestRunLogger(),
  });

@Global()
@Module({})
export class RunsModule {
  static postgres(): DynamicModule {
    return {
      module: RunsModule,
      providers: [
        {
          provide: RUN_REPOSITORY,
          inject: [DATABASE],
          useFactory: (db: Database) => withRunMetrics(new PostgresRunRepository(db)),
        },
      ],
      exports: [RUN_REPOSITORY],
    };
  }

  static inMemory(): DynamicModule {
    return {
      module: RunsModule,
      providers: [
        { provide: RUN_REPOSITORY, useFactory: () => withRunMetrics(new InMemoryRunRepository()) },
      ],
      exports: [RUN_REPOSITORY],
    };
  }
}
