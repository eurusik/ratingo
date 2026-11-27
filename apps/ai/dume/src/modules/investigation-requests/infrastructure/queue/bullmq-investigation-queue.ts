import type { OnApplicationShutdown } from '@nestjs/common';

import type { Queue } from 'bullmq';

import {
  INVESTIGATION_JOB_NAME,
  INVESTIGATION_JOB_OPTIONS,
} from '../../investigation-requests.constants';
import type {
  InvestigationQueuePort,
  QueuedInvestigation,
} from '../../domain/ports/investigation-queue.port';

export class BullmqInvestigationQueue implements InvestigationQueuePort, OnApplicationShutdown {
  constructor(private readonly queue: Pick<Queue, 'add' | 'close' | 'getWaitingCount'>) {}

  async enqueue(job: QueuedInvestigation): Promise<void> {
    await this.queue.add(INVESTIGATION_JOB_NAME, job, {
      ...INVESTIGATION_JOB_OPTIONS,
      jobId: job.requestId,
    });
  }

  waitingCount(): Promise<number> {
    return this.queue.getWaitingCount();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
