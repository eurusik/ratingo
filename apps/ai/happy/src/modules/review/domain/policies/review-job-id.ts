import type { ReviewJob } from '../entities/review-job';

const SEPARATOR = '__';

export const reviewJobId = (job: ReviewJob): string =>
  [
    'review',
    job.ref.owner,
    job.ref.repo,
    job.ref.number,
    job.commentId === null ? (job.headSha ?? 'head') : `comment${job.commentId}`,
  ].join(SEPARATOR);
