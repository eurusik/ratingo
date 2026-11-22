import type { Queue } from 'bullmq';

import { reviewJobId, type ReviewJob } from '../../../review/public';
import type { ReviewQueuePort } from '../../domain/ports/review-queue.port';
import { REVIEW_JOB_OPTIONS, REVIEW_JOB_TYPES } from '../../webhook.constants';

export class BullmqReviewQueue implements ReviewQueuePort {
  constructor(private readonly queue: Queue) {}

  async enqueue(job: ReviewJob): Promise<void> {
    await this.queue.add(REVIEW_JOB_TYPES.REVIEW_PULL_REQUEST, job, {
      ...REVIEW_JOB_OPTIONS,
      jobId: reviewJobId(job),
    });
  }
}
