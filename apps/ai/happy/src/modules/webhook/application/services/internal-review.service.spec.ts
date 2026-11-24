import { PullRequestState, type ReviewResultService } from '../../../review/public';
import {
  TEST_REF,
  buildPullRequest,
} from '../../../review/infrastructure/testing/fake-code-host.testing';
import { InternalRequestStatus } from '../../domain/constants/webhook.constants';
import { EnqueueState } from '../../domain/ports/review-queue.port';

import { InternalReviewService, RepositoryNotConfiguredError } from './internal-review.service';

const CONFIG = {
  allowedRepositories: ['acme/shop', 'acme/other'],
  allowedAuthors: [],
  mentionHandle: 'happy-on-duty',
};

const setup = (options: {
  pr?: ReturnType<typeof buildPullRequest> | null;
  hasResult?: boolean;
  enqueue?: EnqueueState;
  pending?: boolean;
  lookup?: unknown;
  config?: typeof CONFIG;
}) => {
  const enqueue = jest.fn().mockResolvedValue(options.enqueue ?? EnqueueState.QUEUED);
  const isPending = jest.fn().mockResolvedValue(options.pending ?? false);
  const results = {
    findPullRequest: jest
      .fn()
      .mockResolvedValue(options.pr === undefined ? buildPullRequest() : options.pr),
    hasResultFor: jest.fn().mockResolvedValue(options.hasResult ?? false),
    latest: jest.fn().mockResolvedValue(options.lookup),
  } as unknown as ReviewResultService;
  const service = new InternalReviewService(
    options.config ?? CONFIG,
    { enqueue, isPending },
    results,
  );
  return { service, enqueue, isPending, results };
};

describe('InternalReviewService.request', () => {
  it('queues an internal-request job for the first configured repository', async () => {
    const { service, enqueue, results } = setup({});
    expect(await service.request(7)).toEqual({ status: 'queued', headSha: 'head222' });
    expect(enqueue).toHaveBeenCalledWith({
      ref: TEST_REF,
      source: 'internal_request',
      headSha: 'head222',
      commentId: null,
      mode: 'auto',
    });
    expect(results.findPullRequest).toHaveBeenCalledWith(TEST_REF);
  });

  it('maps a pending job to already_running and a finished one to already_reviewed', async () => {
    expect(await setup({ enqueue: EnqueueState.PENDING }).service.request(7)).toMatchObject({
      status: InternalRequestStatus.ALREADY_RUNNING,
    });
    expect(await setup({ enqueue: EnqueueState.FINISHED }).service.request(7)).toMatchObject({
      status: InternalRequestStatus.ALREADY_REVIEWED,
    });
  });

  it('does not enqueue when the head already has a result', async () => {
    const { service, enqueue } = setup({ hasResult: true });
    expect(await service.request(7)).toEqual({ status: 'already_reviewed', headSha: 'head222' });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('queues a full review with its own job and asks for a full result at the head', async () => {
    const { service, enqueue, results } = setup({});
    await service.request(7, 'full');
    expect(results.hasResultFor).toHaveBeenCalledWith(TEST_REF, 'head222', 'full');
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ mode: 'full' }));
  });

  it('answers not_found for a missing pull request without enqueueing', async () => {
    const { service, enqueue } = setup({ pr: null });
    expect(await service.request(7)).toEqual({ status: 'not_found' });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it.each([
    [buildPullRequest({ state: PullRequestState.CLOSED }), 'closed'],
    [buildPullRequest({ state: PullRequestState.CLOSED, merged: true }), 'merged'],
    [buildPullRequest({ headRepository: 'eve/shop' }), 'untrusted_fork'],
  ])('skips with a reason and never enqueues', async (pr, reason) => {
    const { service, enqueue } = setup({ pr });
    expect(await service.request(7)).toEqual({ status: 'skipped', reason });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('refuses to work without a valid configured repository', async () => {
    const { service } = setup({ config: { ...CONFIG, allowedRepositories: [] } });
    await expect(service.request(7)).rejects.toBeInstanceOf(RepositoryNotConfiguredError);
  });
});

describe('InternalReviewService.latest', () => {
  const found = (result: unknown) => ({ status: 'found', headSha: 'head222', result });

  it('does not look at the queue when the result is for the current head', async () => {
    const { service, isPending } = setup({ lookup: found({ current: true }) });
    expect(await service.latest(7)).toMatchObject({ reviewPending: false });
    expect(isPending).not.toHaveBeenCalled();
  });

  it('reports a pending review when the result is missing or old and a job is waiting', async () => {
    const { service } = setup({ lookup: found(null), pending: true });
    expect(await service.latest(7)).toMatchObject({ reviewPending: true });
  });

  it('passes not_found through', async () => {
    const { service } = setup({ lookup: { status: 'not_found' } });
    expect(await service.latest(7)).toEqual({ status: 'not_found' });
  });
});

describe('InternalReviewService.listOpen', () => {
  it('lists open pull requests of the first configured repository', async () => {
    const listOpenPullRequests = jest.fn().mockResolvedValue([{ number: 3 }]);
    const service = new InternalReviewService(
      CONFIG,
      { enqueue: jest.fn(), isPending: jest.fn() },
      { listOpenPullRequests } as never,
    );
    expect(await service.listOpen()).toEqual([{ number: 3 }]);
    expect(listOpenPullRequests).toHaveBeenCalledWith({ owner: 'acme', repo: 'shop' }, 6);
  });
});
