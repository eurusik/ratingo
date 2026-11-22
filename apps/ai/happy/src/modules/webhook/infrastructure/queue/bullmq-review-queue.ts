import type { Queue } from 'bullmq';

import { reviewJobId, type ReviewJob } from '../../../review/public';
import { EnqueueState, type ReviewQueuePort } from '../../domain/ports/review-queue.port';
import { REVIEW_JOB_OPTIONS, REVIEW_JOB_TYPES } from '../../webhook.constants';

const FAILED_STATE = 'failed';
const COMPLETED_STATE = 'completed';
const PENDING_STATES: ReadonlySet<string> = new Set([
  'waiting',
  'active',
  'delayed',
  'prioritized',
  'waiting-children',
]);

export class BullmqReviewQueue implements ReviewQueuePort {
  constructor(private readonly queue: Pick<Queue, 'add' | 'getJob'>) {}

  async enqueue(job: ReviewJob): Promise<EnqueueState> {
    const jobId = reviewJobId(job);
    const existing = await this.queue.getJob(jobId);
    if (existing !== undefined) {
      const state = await existing.getState();
      if (state !== FAILED_STATE) {
        return state === COMPLETED_STATE ? EnqueueState.FINISHED : EnqueueState.PENDING;
      }
      await existing.remove();
    }
    await this.queue.add(REVIEW_JOB_TYPES.REVIEW_PULL_REQUEST, job, {
      ...REVIEW_JOB_OPTIONS,
      jobId,
    });
    return EnqueueState.QUEUED;
  }

  async isPending(job: ReviewJob): Promise<boolean> {
    const existing = await this.queue.getJob(reviewJobId(job));
    return existing !== undefined && PENDING_STATES.has(await existing.getState());
  }
}
