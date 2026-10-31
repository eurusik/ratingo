import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withTimeout } from '../common/utils/with-timeout.util';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as schema from '../database/schema';

import { HEALTH_CHECK_TIMEOUT_MS, HEALTH_QUEUE } from './health.constants';

export type DependencyStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectQueue(HEALTH_QUEUE) private readonly queue: Queue,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      this.probe('database', async () => {
        await this.db.execute(sql`select 1`);
      }),
      this.probe('redis', async () => {
        const client = await this.queue.client;
        if (client.status !== 'ready') {
          throw new Error(`connection is ${client.status}`);
        }
        await client.ping();
      }),
    ]);

    return {
      status: database === 'up' && redis === 'up' ? 'ok' : 'error',
      checks: { database, redis },
    };
  }

  private async probe(name: string, fn: () => Promise<void>): Promise<DependencyStatus> {
    try {
      await withTimeout(
        fn(),
        HEALTH_CHECK_TIMEOUT_MS,
        `timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`,
      );
      return 'up';
    } catch (error) {
      this.logger.warn(
        `Health check failed for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'down';
    }
  }
}
