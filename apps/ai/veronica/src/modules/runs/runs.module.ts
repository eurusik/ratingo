import { type DynamicModule, Global, Module } from '@nestjs/common';

import { InMemoryRunRepository, RUN_REPOSITORY } from '@ratingo/ai-core';

import { DATABASE } from '../../database/database.constants';
import type { Database } from '../../database/database.module';

import { PostgresRunRepository } from './infrastructure/repositories/postgres.run-repository';

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
          useFactory: (db: Database) => new PostgresRunRepository(db),
        },
      ],
      exports: [RUN_REPOSITORY],
    };
  }

  static inMemory(): DynamicModule {
    return {
      module: RunsModule,
      providers: [{ provide: RUN_REPOSITORY, useFactory: () => new InMemoryRunRepository() }],
      exports: [RUN_REPOSITORY],
    };
  }
}
