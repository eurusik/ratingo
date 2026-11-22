import { ReviewJobSource, type ReviewJob } from '../entities/review-job';

const SEPARATOR = '__';

const targetOf = (job: ReviewJob): string => {
  if (job.commentId !== null) return `comment${job.commentId}`;
  const head = job.headSha ?? 'head';
  return job.source === ReviewJobSource.INTERNAL_REQUEST ? `request${SEPARATOR}${head}` : head;
};

export const reviewJobId = (job: ReviewJob): string =>
  ['review', job.ref.owner, job.ref.repo, job.ref.number, targetOf(job)].join(SEPARATOR);
