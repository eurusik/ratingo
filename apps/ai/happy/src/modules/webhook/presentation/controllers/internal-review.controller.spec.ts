import { CodeHostError } from '../../../review/public';
import {
  RepositoryNotConfiguredError,
  type InternalReviewService,
} from '../../application/services/internal-review.service';

import { InternalReviewController } from './internal-review.controller';

const controllerWith = (overrides: Partial<Record<'request' | 'latest' | 'listOpen', jest.Mock>>) =>
  new InternalReviewController({
    request: jest.fn(),
    latest: jest.fn(),
    ...overrides,
  } as unknown as InternalReviewService);

describe('InternalReviewController', () => {
  it('requests a review for a valid number', async () => {
    const request = jest.fn().mockResolvedValue({ status: 'queued', headSha: 'abc' });
    await expect(controllerWith({ request }).request('470', undefined)).resolves.toEqual({
      status: 'queued',
      headSha: 'abc',
    });
    expect(request).toHaveBeenCalledWith(470, 'auto');
  });

  it.each(['0', '-1', '1.5', 'abc', '', '1234567890', '007', '1e3'])(
    'rejects the pull request number %p with 400',
    async (raw) => {
      const request = jest.fn();
      await expect(controllerWith({ request }).request(raw, undefined)).rejects.toMatchObject({
        status: 400,
      });
      await expect(controllerWith({ latest: request }).latest(raw)).rejects.toMatchObject({
        status: 400,
      });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it('shapes the latest result and hides everything that is not part of the contract', async () => {
    const latest = jest.fn().mockResolvedValue({
      status: 'found',
      headSha: 'abc',
      reviewPending: true,
      result: null,
      internal: 'secret',
    });
    await expect(controllerWith({ latest }).latest('5')).resolves.toEqual({
      status: 'found',
      headSha: 'abc',
      reviewPending: true,
      result: null,
    });
  });

  it('passes the requested mode, defaults to auto and rejects anything else', async () => {
    const request = jest.fn().mockResolvedValue({ status: 'queued', headSha: 'abc' });
    const controller = controllerWith({ request });
    await controller.request('5', { mode: 'full' });
    await controller.request('5', {});
    expect(request.mock.calls).toEqual([
      [5, 'full'],
      [5, 'auto'],
    ]);
    for (const body of [{ mode: 'fast' }, { mode: 1 }, { other: true }, 'full']) {
      await expect(controller.request('5', body)).rejects.toMatchObject({ status: 400 });
    }
  });

  it('exposes the review mode, base and status counts of the latest result', async () => {
    const tracking = {
      reviewedSha: 'h',
      scope: { mode: 'incremental', baseSha: 'b', reason: null, files: 3 },
      counts: { new: 1, stillOpen: 2, resolved: 3, needsRecheck: 0 },
      findings: [{ secret: 'not exposed' }],
    };
    const latest = jest.fn().mockResolvedValue({
      status: 'found',
      headSha: 'h',
      reviewPending: false,
      result: { status: 'reviewed', counts: {}, tracking },
    });
    const response = await controllerWith({ latest }).latest('5');
    expect(response).toMatchObject({
      result: {
        review: {
          mode: 'incremental',
          baseSha: 'b',
          fullReason: null,
          files: 3,
          statusCounts: { new: 1, stillOpen: 2, resolved: 3, needsRecheck: 0 },
        },
      },
    });
    expect(JSON.stringify(response)).not.toContain('not exposed');
  });

  it('maps a missing repository to 503 and a code host failure to 502', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(new RepositoryNotConfiguredError())
      .mockRejectedValueOnce(new CodeHostError('get pull request', 500, 'boom'));
    const controller = controllerWith({ request });
    await expect(controller.request('5', undefined)).rejects.toMatchObject({ status: 503 });
    await expect(controller.request('5', undefined)).rejects.toMatchObject({ status: 502 });
  });

  it('lists open pull requests and maps a host failure to 502', async () => {
    const open = [{ number: 1, title: 'A', author: 'a', updatedAt: 'x' }];
    const listOpen = jest
      .fn()
      .mockResolvedValueOnce(open)
      .mockRejectedValueOnce(new CodeHostError('list open pull requests', 500, 'boom'));
    const controller = controllerWith({ listOpen });
    await expect(controller.openPullRequests()).resolves.toEqual({
      status: 'ok',
      pullRequests: open,
    });
    await expect(controller.openPullRequests()).rejects.toMatchObject({ status: 502 });
  });
});
