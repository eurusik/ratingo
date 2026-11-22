import type { ReviewJob } from '../../../review/public';

export const REVIEW_QUEUE_PORT = Symbol('REVIEW_QUEUE_PORT');

export interface ReviewQueuePort {
  enqueue(job: ReviewJob): Promise<void>;
}
