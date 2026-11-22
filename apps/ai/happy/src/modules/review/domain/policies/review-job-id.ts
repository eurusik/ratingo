import { ReviewJobSource, type ReviewJob } from '../entities/review-job';
import { RequestedMode } from '../entities/review-scope';

const SEPARATOR = '__';

const targetOf = (job: ReviewJob): string => {
  if (job.commentId !== null) return `comment${job.commentId}`;
  const head = job.headSha ?? 'head';
  if (job.source !== ReviewJobSource.INTERNAL_REQUEST) return head;
  const kind = job.mode === RequestedMode.FULL ? 'request-full' : 'request';
  return `${kind}${SEPARATOR}${head}`;
};

export const reviewJobId = (job: ReviewJob): string =>
  ['review', job.ref.owner, job.ref.repo, job.ref.number, targetOf(job)].join(SEPARATOR);
