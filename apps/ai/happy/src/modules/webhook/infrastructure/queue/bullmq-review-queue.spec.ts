import { ReviewJobSource, reviewJobId, type ReviewJob } from '../../../review/public';
import { EnqueueState } from '../../domain/ports/review-queue.port';

import { BullmqReviewQueue } from './bullmq-review-queue';

const JOB: ReviewJob = {
  ref: { owner: 'acme', repo: 'shop', number: 7 },
  source: ReviewJobSource.INTERNAL_REQUEST,
  headSha: 'head222',
  commentId: null,
};

const queueWith = (state: string | undefined) => {
  const remove = jest.fn();
  const add = jest.fn();
  const getJob = jest
    .fn()
    .mockResolvedValue(state === undefined ? undefined : { getState: async () => state, remove });
  return { queue: new BullmqReviewQueue({ add, getJob } as never), add, remove, getJob };
};

describe('BullmqReviewQueue', () => {
  it('adds a new job under its deterministic id', async () => {
    const { queue, add } = queueWith(undefined);
    expect(await queue.enqueue(JOB)).toBe(EnqueueState.QUEUED);
    expect(add).toHaveBeenCalledWith(
      'review-pull-request',
      JOB,
      expect.objectContaining({ jobId: reviewJobId(JOB) }),
    );
  });

  it.each(['waiting', 'active', 'delayed'])('coalesces onto a %s job', async (state) => {
    const { queue, add } = queueWith(state);
    expect(await queue.enqueue(JOB)).toBe(EnqueueState.PENDING);
    expect(add).not.toHaveBeenCalled();
  });

  it('reports a completed job without adding another', async () => {
    const { queue, add } = queueWith('completed');
    expect(await queue.enqueue(JOB)).toBe(EnqueueState.FINISHED);
    expect(add).not.toHaveBeenCalled();
  });

  it('replaces a failed job so the request is not swallowed', async () => {
    const { queue, add, remove } = queueWith('failed');
    expect(await queue.enqueue(JOB)).toBe(EnqueueState.QUEUED);
    expect(remove).toHaveBeenCalled();
    expect(add).toHaveBeenCalled();
  });

  it('knows which jobs are still pending', async () => {
    expect(await queueWith('active').queue.isPending(JOB)).toBe(true);
    expect(await queueWith('completed').queue.isPending(JOB)).toBe(false);
    expect(await queueWith(undefined).queue.isPending(JOB)).toBe(false);
  });
});
