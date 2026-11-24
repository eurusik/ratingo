import { RequestedMode } from '../../domain/entities/review-scope';
import { CodeHostError } from '../../domain/ports/code-host.port';
import type { PublishedCheck, PublishedCheckPort } from '../../domain/ports/published-check.port';
import type { ReviewResultSnapshot } from '../../domain/entities/review-result';
import { buildResultSnapshot } from '../../domain/policies/review-result';
import { ReviewStatus } from '../../domain/entities/review-outcome';
import {
  TEST_REF,
  buildFakeCodeHost,
  buildPullRequest,
} from '../../infrastructure/testing/fake-code-host.testing';

import { trackingOf } from '../../infrastructure/testing/outcome.testing';

import { ReviewResultService } from './review-result.service';

const SNAPSHOT: ReviewResultSnapshot = buildResultSnapshot({
  status: ReviewStatus.REVIEWED,
  ref: TEST_REF,
  headSha: 'x',
  summary: 'Все гаразд',
  findings: [],
  questions: [],
  dropped: [],
  tracking: trackingOf([]),
  reviewedFiles: [],
  coverage: { unreviewedFiles: [], gaps: [] },
  stopReason: 'end',
  budgetExhausted: false,
  costUsd: 0,
  markdown: '',
});

const check = (
  headSha: string,
  snapshot: ReviewResultSnapshot | null = SNAPSHOT,
): PublishedCheck => ({
  headSha,
  title: 'Периметр чистий. Проходь.',
  snapshot,
  url: `https://github.com/acme/shop/runs/${headSha}`,
  trusted: true,
});

const setup = (checks: Record<string, PublishedCheck>, recent: string[] = [], head = 'head222') => {
  const lookups: string[] = [];
  const port: PublishedCheckPort = {
    findForCommit: async (_ref, sha) => {
      lookups.push(sha);
      return checks[sha] ?? null;
    },
    listRecentCommitShas: async () => recent,
  };
  const host = buildFakeCodeHost({ pr: buildPullRequest({ headSha: head }) });
  return { service: new ReviewResultService(host, port), lookups };
};

describe('ReviewResultService', () => {
  it('returns the result for the current head and marks it current', async () => {
    const { service } = setup({ head222: check('head222') });
    const lookup = await service.latest(TEST_REF);
    expect(lookup).toMatchObject({
      status: 'found',
      headSha: 'head222',
      result: { current: true, checkedSha: 'head222', status: 'reviewed', summary: 'Все гаразд' },
    });
  });

  it('falls back to an earlier commit and marks the result as not current', async () => {
    const { service, lookups } = setup({ old111: check('old111') }, [
      'old111',
      'head222',
      'older000',
    ]);
    const lookup = await service.latest(TEST_REF);
    expect(lookup).toMatchObject({ result: { current: false, checkedSha: 'old111' } });
    expect(lookups).toEqual(['head222', 'old111']);
  });

  it('reports no result when no commit has a check', async () => {
    const { service } = setup({}, ['a1', 'b2']);
    expect(await service.latest(TEST_REF)).toEqual({
      status: 'found',
      headSha: 'head222',
      baseBranch: 'main',
      headBranch: 'feature/checkout',
      result: null,
    });
  });

  it('returns an unknown result for a check without a readable marker', async () => {
    const { service } = setup({ head222: check('head222', null) });
    const lookup = await service.latest(TEST_REF);
    expect(lookup).toMatchObject({
      result: { status: 'unknown', title: 'Периметр чистий. Проходь.', summary: '' },
    });
  });

  it('treats a missing pull request as not found and rethrows other host errors', async () => {
    const missing = new ReviewResultService(
      {
        getPullRequest: async () => {
          throw new CodeHostError('get pull request', 404, 'x');
        },
      } as never,
      {} as never,
    );
    expect(await missing.latest(TEST_REF)).toEqual({ status: 'not_found' });
    const broken = new ReviewResultService(
      {
        getPullRequest: async () => {
          throw new CodeHostError('get pull request', 500, 'x');
        },
      } as never,
      {} as never,
    );
    await expect(broken.latest(TEST_REF)).rejects.toBeInstanceOf(CodeHostError);
  });

  it('carries the branches and recognises a release checklist, and does not call an old check without a marker one', async () => {
    const release = buildFakeCodeHost({
      pr: buildPullRequest({ headSha: 'head222', baseRef: 'main', headRef: 'development' }),
    });
    const withMarker = new ReviewResultService(release, {
      findForCommit: async () => ({
        ...check('head222'),
        snapshot: { ...SNAPSHOT, kind: 'release_checklist', status: 'checklist' },
      }),
      listRecentCommitShas: async () => [],
    });
    expect(await withMarker.latest(TEST_REF)).toMatchObject({
      baseBranch: 'main',
      headBranch: 'development',
      result: { kind: 'release_checklist' },
    });
    const oldCheck = new ReviewResultService(release, {
      findForCommit: async () => check('head222', null),
      listRecentCommitShas: async () => [],
    });
    expect(await oldCheck.latest(TEST_REF)).toMatchObject({
      baseBranch: 'main',
      headBranch: 'development',
      result: { kind: 'review', status: 'unknown', checklist: null },
    });
    const feature = setup({ head222: check('head222', null) });
    expect(await feature.service.latest(TEST_REF)).toMatchObject({
      baseBranch: 'main',
      result: { kind: 'review' },
    });
  });

  describe('a full review that cannot get a review scope', () => {
    const full = (snapshot: Partial<typeof SNAPSHOT>, trusted = true) =>
      new ReviewResultService(buildFakeCodeHost(), {
        findForCommit: async () => ({
          ...check('head222'),
          trusted,
          snapshot: { ...SNAPSHOT, ...snapshot },
        }),
        listRecentCommitShas: async () => [],
      }).hasResultFor(TEST_REF, 'head222', RequestedMode.FULL);

    it('counts a release checklist and a skipped result as done', async () => {
      expect(await full({ kind: 'release_checklist', status: 'checklist' })).toBe(true);
      expect(await full({ status: 'skipped' })).toBe(true);
    });

    it('still wants a full scope from an ordinary review, and trusts only its own check runs', async () => {
      expect(await full({ status: 'reviewed', kind: 'review', tracking: null })).toBe(false);
      expect(await full({ kind: 'release_checklist', status: 'checklist' }, false)).toBe(false);
    });
  });
});
