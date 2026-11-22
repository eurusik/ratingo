import { Module, type OnApplicationShutdown, Inject } from '@nestjs/common';

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { INFRA_CONFIG, type InfraConfig } from '../../config/config.constants';
import { DATABASE } from '../../database/database.constants';
import type { Database } from '../../database/database.module';
import { NotifyModule } from '../notify/public';

import { DigestDeliveryService } from './application/services/digest-delivery.service';
import { DigestSchedulerService } from './application/services/digest-scheduler.service';
import { DigestWorker } from './application/workers/digest.worker';
import { DigestModule } from './digest.module';
import {
  DIGEST_QUEUE,
  DIGEST_QUEUE_PREFIX,
  DIGEST_QUEUE_TOKEN,
  REDIS_CONNECTION,
} from './digest.constants';
import { DIGEST_DELIVERY_REPOSITORY } from './domain/ports/digest-delivery.repository';
import { PostgresDigestDeliveryRepository } from './infrastructure/repositories/postgres.digest-delivery-repository';

@Module({
  imports: [DigestModule, NotifyModule],
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [INFRA_CONFIG],
      useFactory: (config: InfraConfig) =>
        new IORedis(config.redisUrl, { maxRetriesPerRequest: null }),
    },
    {
      provide: DIGEST_QUEUE_TOKEN,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue(DIGEST_QUEUE, {
          connection: connection.duplicate(),
          prefix: DIGEST_QUEUE_PREFIX,
        }),
    },
    {
      provide: DIGEST_DELIVERY_REPOSITORY,
      inject: [DATABASE],
      useFactory: (db: Database) => new PostgresDigestDeliveryRepository(db),
    },
    DigestDeliveryService,
    DigestSchedulerService,
    DigestWorker,
  ],
})
export class DigestScheduleModule implements OnApplicationShutdown {
  constructor(
    @Inject(DIGEST_QUEUE_TOKEN) private readonly queue: Queue,
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}
