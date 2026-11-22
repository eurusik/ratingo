import { UnrecoverableError } from 'bullmq';

import {
  RepositoryNotAllowedError,
  ReviewJobSource,
  type ReviewJob,
  type ReviewJobService,
} from '../../../review/public';
import { REVIEW_JOB_TYPES } from '../../webhook.constants';

import { ReviewWorker } from './review.worker';

const JOB: ReviewJob = {
  ref: { owner: 'a', repo: 'b', number: 1 },
  source: ReviewJobSource.PULL_REQUEST,
  headSha: 'sha',
  commentId: null,
};

const workerWith = (process: jest.Mock) =>
  new ReviewWorker({ process } as unknown as ReviewJobService, {} as never, {} as never);

describe('ReviewWorker', () => {
  it('hands a review job to the job service', async () => {
    const process = jest.fn().mockResolvedValue('published');
    const result = await workerWith(process).process({
      name: REVIEW_JOB_TYPES.REVIEW_PULL_REQUEST,
      data: JOB,
    });
    expect(result).toBe('published');
    expect(process).toHaveBeenCalledWith(JOB);
  });

  it('ignores unknown job types', async () => {
    const process = jest.fn();
    expect(await workerWith(process).process({ name: 'other', data: JOB })).toBe('ignored');
    expect(process).not.toHaveBeenCalled();
  });

  it('does not retry a repository that is not allowed but retries other failures', async () => {
    const blocked = workerWith(jest.fn().mockRejectedValue(new RepositoryNotAllowedError('a/b')));
    await expect(
      blocked.process({ name: REVIEW_JOB_TYPES.REVIEW_PULL_REQUEST, data: JOB }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    const flaky = workerWith(jest.fn().mockRejectedValue(new Error('network')));
    await expect(
      flaky.process({ name: REVIEW_JOB_TYPES.REVIEW_PULL_REQUEST, data: JOB }),
    ).rejects.not.toBeInstanceOf(UnrecoverableError);
  });
});
