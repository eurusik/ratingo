import { FindingKind } from '../../domain/constants/finding-classification.constants';
import { FindingCategory, Severity } from '../../domain/constants/severity.constants';
import { CommitRelation } from '../../domain/entities/pull-request';
import { ReviewStatus } from '../../domain/entities/review-outcome';
import type { ReviewResultSnapshot } from '../../domain/entities/review-result';
import { FullReviewReason, RequestedMode, ReviewMode } from '../../domain/entities/review-scope';
import { FindingStatus } from '../../domain/entities/tracked-finding';
import type { PublishedCheck } from '../../domain/ports/published-check.port';
import {
  FakePublishedChecks,
  buildChangedFile,
  buildFakeCodeHost,
  buildPullRequest,
} from '../../infrastructure/testing/fake-code-host.testing';

import { ReviewScopeService } from './review-scope.service';

const HEAD = 'head222';
const finding = {
  fingerprint: 'fp',
  file: 'a.ts',
  line: 1,
  severity: Severity.MAJOR,
  category: FindingCategory.CORRECTNESS,
  kind: FindingKind.FINDING,
  message: 'm',
  excerpt: 'x',
  status: FindingStatus.NEW,
};

const check = (sha: string, overrides: Partial<ReviewResultSnapshot> = {}): PublishedCheck => ({
  headSha: sha,
  title: 't',
  url: null,
  trusted: true,
  snapshot: {
    status: ReviewStatus.REVIEWED,
    title: 't',
    summary: '',
    skipReason: null,
    counts: { critical: 0, major: 1, minor: 0, nit: 0 },
    questions: [],
    coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
    tracking: {
      reviewedSha: sha,
      scope: {
        mode: ReviewMode.FULL,
        baseSha: null,
        reason: FullReviewReason.NO_PREVIOUS,
        files: 1,
      },
      counts: { new: 1, stillOpen: 0, resolved: 0, needsRecheck: 0 },
      findings: [finding],
    },
    ...overrides,
  },
});

const plan = (
  checks: Record<string, PublishedCheck>,
  recent: string[],
  comparison = {
    relation: CommitRelation.AHEAD,
    files: [buildChangedFile({ path: 'b.ts' })],
    truncated: false,
  },
) => {
  const host = buildFakeCodeHost({
    pr: buildPullRequest({ headSha: HEAD }),
    comparison,
  });
  const service = new ReviewScopeService(
    host,
    new FakePublishedChecks(new Map(Object.entries(checks)), recent),
  );
  const prFiles = [buildChangedFile({ path: 'a.ts' }), buildChangedFile({ path: 'b.ts' })];
  return service.plan(host.data.pr, prFiles, RequestedMode.AUTO);
};

describe('ReviewScopeService', () => {
  it('goes incremental from the newest earlier review and ignores the head itself', async () => {
    const result = await plan({ [HEAD]: check(HEAD), old1: check('old1') }, [HEAD, 'old1']);
    expect(result.scope).toEqual({ mode: ReviewMode.INCREMENTAL, baseSha: 'old1' });
    expect(result.previous).toEqual([finding]);
    expect(result.incrementalFiles?.map((file) => file.path)).toEqual(['b.ts']);
  });

  it('looks past commits that were skipped or got a checklist', async () => {
    const skipped = check('mid', { status: ReviewStatus.SKIPPED, tracking: null });
    const result = await plan({ mid: skipped, old1: check('old1') }, ['mid', 'old1']);
    expect(result.scope).toEqual({ mode: ReviewMode.INCREMENTAL, baseSha: 'old1' });
  });

  it('keeps touched files that already left the pull request, for the carry-over', async () => {
    const result = await plan({ old1: check('old1') }, ['old1'], {
      relation: CommitRelation.AHEAD,
      files: [buildChangedFile({ path: 'gone.ts' }), buildChangedFile({ path: 'b.ts' })],
      truncated: false,
    });
    expect(result.incrementalFiles?.map((file) => file.path)).toEqual(['b.ts']);
    expect(result.touchedFiles.map((file) => file.path)).toEqual(['gone.ts', 'b.ts']);
  });

  it('finds nothing to build on when no recent commit has a review', async () => {
    const result = await plan({}, ['c1', 'c2']);
    expect(result.scope).toEqual({ mode: ReviewMode.FULL, reason: FullReviewReason.NO_PREVIOUS });
    expect(result.previousFound).toBe(false);
  });

  it('does not compare when a full review is chosen up front', async () => {
    const result = await plan(
      { old1: check('old1', { coverage: { complete: false, unreviewedFiles: 2, gaps: [] } }) },
      ['old1'],
    );
    expect(result.scope).toEqual({
      mode: ReviewMode.FULL,
      reason: FullReviewReason.PREVIOUS_INCOMPLETE,
    });
    expect(result.previous).toEqual([finding]);
  });
});
