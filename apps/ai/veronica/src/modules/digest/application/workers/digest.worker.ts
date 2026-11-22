import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';

import { UnrecoverableError, Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';

import { RunTrigger } from '@ratingo/ai-core';

import {
  DIGEST_JOB_TYPES,
  DIGEST_QUEUE,
  DIGEST_QUEUE_PREFIX,
  REDIS_CONNECTION,
} from '../../digest.constants';
import { NotificationError } from '../../../notify/public';
import { DigestDeliveryService } from '../services/digest-delivery.service';

@Injectable()
export class DigestWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DigestWorker.name);
  private worker?: Worker;

  constructor(
    private readonly delivery: DigestDeliveryService,
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(DIGEST_QUEUE, (job) => this.process(job), {
      connection: this.connection.duplicate(),
      prefix: DIGEST_QUEUE_PREFIX,
      concurrency: 1,
    });
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Завдання ${job?.name ?? '?'} не вдалося: ${error.message}`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  async process(job: Pick<Job, 'name'>): Promise<string> {
    if (job.name !== DIGEST_JOB_TYPES.DAILY_DIGEST) {
      this.logger.warn(`Невідомий тип завдання ${job.name}`);
      return 'ignored';
    }
    try {
      return await this.delivery.deliver(RunTrigger.SCHEDULE);
    } catch (error) {
      if (error instanceof NotificationError && !error.retryable) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }
}
