import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';

import * as schema from './schema';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
export const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL');
        if (!connectionString) {
          throw new Error('DATABASE_URL is not defined');
        }
        return postgres(connectionString);
      },
    },
    {
      provide: DATABASE_CONNECTION,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: postgres.Sql) => drizzle(client, { schema }),
    },
  ],
  exports: [DATABASE_CONNECTION, POSTGRES_CLIENT],
})
export class DatabaseModule {}
