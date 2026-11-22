import { Module } from '@nestjs/common';

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import {
  HAPPY_CONFIG,
  INFRA_CONFIG,
  type HappyConfig,
  type InfraConfig,
} from '../../config/config.constants';
import { DATABASE } from '../../database/database.constants';
import type { Database } from '../../database/database.module';
import { NotifyModule } from '../notify/public';

import { WatchdogQueueRepair } from './application/services/watchdog-queue-repair.service';
import { WatchdogSchedulerService } from './application/services/watchdog-scheduler.service';
import { WatchdogService } from './application/services/watchdog.service';
import { WatchdogWorker } from './application/workers/watchdog.worker';
import {
  DIGEST_DELIVERY_PROBE_PORT,
  FAILED_RUNS_PORT,
  HAPPY_HEALTH_PORT,
  QUEUE_KEY_REPAIR_PORT,
  WATCHDOG_HEARTBEAT_PORT,
  WATCHDOG_STATE_PORT,
} from './domain/ports/watchdog.ports';
import { HttpHappyHealthAdapter } from './infrastructure/adapters/http.happy-health.adapter';
import { PostgresDigestDeliveryProbe } from './infrastructure/repositories/postgres.digest-delivery-probe';
import { PostgresFailedRunsRepository } from './infrastructure/repositories/postgres.failed-runs.repository';
import { RedisQueueKeyRepair } from './infrastructure/stores/redis.queue-key-repair';
import { RedisWatchdogStateStore } from './infrastructure/stores/redis.watchdog-state.store';
import { OtelWatchdogHeartbeat } from './infrastructure/telemetry/otel-watchdog-heartbeat';
import {
  REDIS_CONNECTION,
  WATCHDOG_QUEUE,
  WATCHDOG_QUEUE_PREFIX,
  WATCHDOG_QUEUE_TOKEN,
} from './watchdog.constants';

@Module({
  imports: [NotifyModule],
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [INFRA_CONFIG],
      useFactory: (config: InfraConfig) =>
        new IORedis(config.redisUrl, { maxRetriesPerRequest: null }),
    },
    {
      provide: WATCHDOG_QUEUE_TOKEN,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue(WATCHDOG_QUEUE, {
          connection: connection.duplicate(),
          prefix: WATCHDOG_QUEUE_PREFIX,
        }),
    },
    {
      provide: HAPPY_HEALTH_PORT,
      inject: [HAPPY_CONFIG],
      useFactory: (config: HappyConfig) => new HttpHappyHealthAdapter(config),
    },
    {
      provide: DIGEST_DELIVERY_PROBE_PORT,
      inject: [DATABASE],
      useFactory: (db: Database) => new PostgresDigestDeliveryProbe(db),
    },
    {
      provide: FAILED_RUNS_PORT,
      inject: [DATABASE],
      useFactory: (db: Database) => new PostgresFailedRunsRepository(db),
    },
    {
      provide: WATCHDOG_STATE_PORT,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) => new RedisWatchdogStateStore(connection),
    },
    {
      provide: QUEUE_KEY_REPAIR_PORT,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) => new RedisQueueKeyRepair(connection),
    },
    WatchdogQueueRepair,
    { provide: WATCHDOG_HEARTBEAT_PORT, useFactory: () => new OtelWatchdogHeartbeat() },
    WatchdogService,
    WatchdogSchedulerService,
    WatchdogWorker,
  ],
})
export class WatchdogModule {}
