import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { INFRA_CONFIG, type InfraConfig } from '../config/config.constants';

import { DATABASE } from './database.constants';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      inject: [INFRA_CONFIG],
      useFactory: (config: InfraConfig) => postgres(config.databaseUrl),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_CLIENT],
      useFactory: (client: postgres.Sql): Database => drizzle(client, { schema }),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end();
  }
}
