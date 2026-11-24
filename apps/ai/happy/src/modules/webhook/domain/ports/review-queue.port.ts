import type { ReviewJob } from '../../../review/public';

export const REVIEW_QUEUE_PORT = Symbol('REVIEW_QUEUE_PORT');

export const EnqueueState = {
  QUEUED: 'queued',
  PENDING: 'pending',
  FINISHED: 'finished',
} as const;
export type EnqueueState = (typeof EnqueueState)[keyof typeof EnqueueState];

export interface ReviewQueuePort {
  enqueue(job: ReviewJob): Promise<EnqueueState>;
  isPending(job: ReviewJob): Promise<boolean>;
}
