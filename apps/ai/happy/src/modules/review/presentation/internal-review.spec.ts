import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import { RunTrigger } from '@ratingo/ai-core';

import type { ReviewConfig } from '../../../config/config.constants';
import type { ReviewService } from '../application/services/review.service';
import { RepositoryNotAllowedError } from '../domain/errors/review.errors';
import { CodeHostError } from '../domain/ports/code-host.port';

import { InternalReviewController } from './controllers/internal-review.controller';
import { ServiceTokenGuard } from './guards/service-token.guard';
import { parseRepository } from './parse-repository';

const TOKEN = 'a-service-token-of-24-chars!';

const contextWith = (token: string | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: token === undefined ? {} : { 'x-service-token': token } }),
    }),
  }) as unknown as ExecutionContext;

const guardFor = (serviceToken: string | undefined): ServiceTokenGuard =>
  new ServiceTokenGuard({
    allowedRepositories: [],
    allowedAuthors: [],
    mentionHandle: 'happy-on-duty',
    serviceToken,
  } as ReviewConfig);

describe('ServiceTokenGuard', () => {
  it('lets the right token through', () => {
    expect(guardFor(TOKEN).canActivate(contextWith(TOKEN))).toBe(true);
  });

  it.each([undefined, '', 'wrong', `${TOKEN}x`])('rejects %p', (token) => {
    expect(() => guardFor(TOKEN).canActivate(contextWith(token))).toThrow(UnauthorizedException);
  });

  it('rejects everything when no token is configured', () => {
    expect(() => guardFor(undefined).canActivate(contextWith(TOKEN))).toThrow(
      UnauthorizedException,
    );
    expect(() => guardFor(undefined).canActivate(contextWith(undefined))).toThrow(
      UnauthorizedException,
    );
  });
});

describe('InternalReviewController', () => {
  const outcome = { markdown: 'done', status: 'reviewed', costUsd: 0.1 };

  it('runs a review for a valid request as a chat-triggered run', async () => {
    const review = jest.fn().mockResolvedValue(outcome);
    const controller = new InternalReviewController({ review } as unknown as ReviewService);
    await expect(controller.review({ repository: 'acme/shop', pullNumber: 7 })).resolves.toEqual(
      outcome,
    );
    expect(review).toHaveBeenCalledWith(
      { owner: 'acme', repo: 'shop', number: 7 },
      RunTrigger.CHAT,
    );
  });

  it.each([{}, { repository: 'acme', pullNumber: 1 }, { repository: 'a/b', pullNumber: 0 }, null])(
    'rejects the invalid body %p with 400',
    async (body) => {
      const controller = new InternalReviewController({
        review: jest.fn(),
      } as unknown as ReviewService);
      await expect(controller.review(body)).rejects.toMatchObject({ status: 400 });
    },
  );

  it('maps an unlisted repository to 403 and a host failure to 502', async () => {
    const review = jest
      .fn()
      .mockRejectedValueOnce(new RepositoryNotAllowedError('x/y'))
      .mockRejectedValueOnce(new CodeHostError('get pull request', 500, 'boom'));
    const controller = new InternalReviewController({ review } as unknown as ReviewService);
    const body = { repository: 'x/y', pullNumber: 1 };
    await expect(controller.review(body)).rejects.toMatchObject({ status: 403 });
    await expect(controller.review(body)).rejects.toMatchObject({ status: 502 });
  });
});

describe('parseRepository', () => {
  it.each([
    ['acme/shop', { owner: 'acme', repo: 'shop' }],
    ['a/b/c', null],
    ['../x', null],
    ['acme', null],
    ['', null],
  ])('%p', (value, expected) => {
    expect(parseRepository(value)).toEqual(expected);
  });
});
