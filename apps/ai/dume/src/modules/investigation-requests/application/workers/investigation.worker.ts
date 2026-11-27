import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';

import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';

import {
  INVESTIGATION_JOB_NAME,
  INVESTIGATION_QUEUE_NAME,
  INVESTIGATION_QUEUE_PREFIX,
  INVESTIGATION_WORKER_CONCURRENCY,
  QUEUE_REDIS,
} from '../../investigation-requests.constants';
import type { QueuedInvestigation } from '../../domain/ports/investigation-queue.port';
import { RunInvestigationService } from '../services/run-investigation.service';

const isQueuedInvestigation = (value: unknown): value is QueuedInvestigation =>
  typeof (value as Partial<QueuedInvestigation> | null)?.requestId === 'string';

@Injectable()
export class InvestigationWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(InvestigationWorker.name);
  private worker?: Worker;

  constructor(
    private readonly runs: RunInvestigationService,
    @Inject(QUEUE_REDIS) private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(INVESTIGATION_QUEUE_NAME, (job) => this.process(job), {
      connection: this.connection.duplicate(),
      prefix: INVESTIGATION_QUEUE_PREFIX,
      concurrency: INVESTIGATION_WORKER_CONCURRENCY,
      maxStalledCount: 0,
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error({
        message: 'investigation_job.failed',
        jobId: job?.id ?? null,
        reason: error.name,
      });
      if (job !== undefined && isQueuedInvestigation(job.data)) {
        this.markInterrupted(job.data.requestId);
      }
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private markInterrupted(requestId: string): void {
    this.runs.markInterrupted(requestId).catch((error: unknown) =>
      this.logger.error({
        message: 'investigation_request.mark_interrupted_failed',
        requestId,
        reason: error instanceof Error ? error.name : 'error',
      }),
    );
  }

  async process(job: Pick<Job, 'name' | 'data'>): Promise<string> {
    if (job.name !== INVESTIGATION_JOB_NAME || !isQueuedInvestigation(job.data)) {
      this.logger.warn({ message: 'investigation_job.unknown', jobName: job.name });
      return 'ignored';
    }
    return this.runs.run(job.data.requestId);
  }
}
