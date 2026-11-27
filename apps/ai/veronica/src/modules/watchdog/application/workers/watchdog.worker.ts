import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';

import { Worker, type Job, type Queue } from 'bullmq';
import type IORedis from 'ioredis';

import {
  REDIS_CONNECTION,
  WATCHDOG_JOB_TYPES,
  WATCHDOG_QUEUE,
  WATCHDOG_QUEUE_PREFIX,
  WATCHDOG_QUEUE_TOKEN,
} from '../../watchdog.constants';
import { WatchdogService } from '../services/watchdog.service';
import { withRedisErrorLog } from '../../../../redis/redis-error-log';

@Injectable()
export class WatchdogWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(WatchdogWorker.name);
  private worker?: Worker;

  constructor(
    private readonly watchdog: WatchdogService,
    @Inject(WATCHDOG_QUEUE_TOKEN) private readonly queue: Queue,
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(WATCHDOG_QUEUE, (job) => this.process(job), {
      connection: withRedisErrorLog(this.connection.duplicate(), 'watchdog-worker'),
      prefix: WATCHDOG_QUEUE_PREFIX,
      concurrency: 1,
    });
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Перевірка сторожа ${job?.id ?? '?'} не вдалася: ${error.message}`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async process(job: Pick<Job, 'name'>): Promise<string> {
    if (job.name !== WATCHDOG_JOB_TYPES.TICK) {
      this.logger.warn(`Невідомий тип завдання сторожа ${job.name}`);
      return 'ignored';
    }
    return this.watchdog.tick();
  }
}
