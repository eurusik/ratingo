import type { OnApplicationShutdown } from '@nestjs/common';

import type { Queue } from 'bullmq';

import {
  INVESTIGATION_JOB_NAME,
  INVESTIGATION_JOB_OPTIONS,
  QUEUE_CALL_TIMEOUT_MS,
} from '../../investigation-requests.constants';
import type {
  InvestigationQueuePort,
  QueuedInvestigation,
} from '../../domain/ports/investigation-queue.port';

export class QueueTimeoutError extends Error {
  constructor(operation: string) {
    super(`The queue did not answer ${operation} in time`);
    this.name = 'QueueTimeoutError';
  }
}

const withTimeout = <T>(operation: string, call: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new QueueTimeoutError(operation)), QUEUE_CALL_TIMEOUT_MS);
  });
  return Promise.race([call, timeout]).finally(() => clearTimeout(timer));
};

export class BullmqInvestigationQueue implements InvestigationQueuePort, OnApplicationShutdown {
  constructor(private readonly queue: Pick<Queue, 'add' | 'close' | 'getWaitingCount'>) {}

  async enqueue(job: QueuedInvestigation): Promise<void> {
    await withTimeout(
      'add',
      this.queue.add(INVESTIGATION_JOB_NAME, job, {
        ...INVESTIGATION_JOB_OPTIONS,
        jobId: job.requestId,
      }),
    );
  }

  waitingCount(): Promise<number> {
    return withTimeout('count', this.queue.getWaitingCount());
  }

  close(): Promise<void> {
    return this.queue.close();
  }

  onApplicationShutdown(): Promise<void> {
    return this.close();
  }
}
