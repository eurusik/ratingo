import * as fc from 'fast-check';

import { ReviewJobSource, type ReviewJob } from '../entities/review-job';

import { reviewJobId } from './review-job-id';

const name = fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/);
const jobArb: fc.Arbitrary<ReviewJob> = fc
  .record({
    owner: name,
    repo: name,
    number: fc.integer({ min: 1, max: 5000 }),
    headSha: fc.stringMatching(/^[0-9a-f]{40}$/),
  })
  .map(({ owner, repo, number, headSha }) => ({
    ref: { owner, repo, number },
    source: ReviewJobSource.PULL_REQUEST,
    headSha,
    commentId: null,
  }));

describe('reviewJobId', () => {
  it('is the same for a redelivered event and has no characters BullMQ rejects', () => {
    fc.assert(
      fc.property(jobArb, (job) => {
        const id = reviewJobId(job);
        return id === reviewJobId({ ...job, ref: { ...job.ref } }) && !id.includes(':');
      }),
    );
  });

  it('differs when the commit or the pull request differs', () => {
    fc.assert(
      fc.property(jobArb, jobArb, (left, right) => {
        const sameTarget =
          left.ref.owner === right.ref.owner &&
          left.ref.repo === right.ref.repo &&
          left.ref.number === right.ref.number &&
          left.headSha === right.headSha;
        return sameTarget || reviewJobId(left) !== reviewJobId(right);
      }),
    );
  });

  it('keys a command by its comment so repeating the command is a new review', () => {
    const base: ReviewJob = {
      ref: { owner: 'a', repo: 'b', number: 1 },
      source: ReviewJobSource.COMMAND,
      headSha: null,
      commentId: 11,
    };
    expect(reviewJobId(base)).not.toBe(reviewJobId({ ...base, commentId: 12 }));
    expect(reviewJobId(base)).toBe(reviewJobId({ ...base }));
  });
});
