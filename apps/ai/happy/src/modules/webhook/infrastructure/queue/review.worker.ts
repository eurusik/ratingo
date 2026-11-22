import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';

import { UnrecoverableError, Worker, type Job, type Queue } from 'bullmq';
import type IORedis from 'ioredis';

import {
  RepositoryNotAllowedError,
  ReviewJobService,
  type ReviewJob,
} from '../../../review/public';
import {
  REVIEW_JOB_TYPES,
  REVIEW_QUEUE,
  REVIEW_QUEUE_INSTANCE,
  REVIEW_QUEUE_PREFIX,
  REVIEW_REDIS,
} from '../../webhook.constants';

@Injectable()
export class ReviewWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ReviewWorker.name);
  private worker?: Worker;

  constructor(
    private readonly jobs: ReviewJobService,
    @Inject(REVIEW_QUEUE_INSTANCE) private readonly queue: Queue,
    @Inject(REVIEW_REDIS) private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(REVIEW_QUEUE, (job) => this.process(job), {
      connection: this.connection.duplicate(),
      prefix: REVIEW_QUEUE_PREFIX,
      concurrency: 1,
    });
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Job ${job?.id ?? '?'} failed: ${error.message}`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async process(job: Pick<Job<ReviewJob>, 'name' | 'data'>): Promise<string> {
    if (job.name !== REVIEW_JOB_TYPES.REVIEW_PULL_REQUEST) {
      this.logger.warn(`Unknown job type ${job.name}`);
      return 'ignored';
    }
    try {
      return await this.jobs.process(job.data);
    } catch (error) {
      if (error instanceof RepositoryNotAllowedError) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }
}
