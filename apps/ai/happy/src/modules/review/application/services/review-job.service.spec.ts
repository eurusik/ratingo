import type { CheckReport } from '../../domain/entities/check-report';
import { PullRequestState } from '../../domain/entities/pull-request';
import { CheckVoice } from '../../domain/constants/check-voice.constants';
import { ReviewJobSource, type ReviewJob } from '../../domain/entities/review-job';
import { ReviewStatus, type ReviewOutcome } from '../../domain/entities/review-outcome';
import type { CheckRunPublisherPort } from '../../domain/ports/check-run-publisher.port';
import {
  TEST_REF,
  buildFakeCodeHost,
  buildPullRequest,
} from '../../infrastructure/testing/fake-code-host.testing';

import { ReviewJobResult, ReviewJobService } from './review-job.service';
import type { ReviewService } from './review.service';

const JOB: ReviewJob = {
  ref: TEST_REF,
  source: ReviewJobSource.PULL_REQUEST,
  headSha: 'head222',
  commentId: null,
};

const reviewed = (headSha = 'head222'): ReviewOutcome => ({
  status: ReviewStatus.REVIEWED,
  ref: TEST_REF,
  headSha,
  summary: 's',
  findings: [],
  questions: [],
  dropped: [],
  reviewedFiles: [],
  coverage: { unreviewedFiles: [], gaps: [] },
  stopReason: 'end',
  budgetExhausted: false,
  costUsd: 0.01,
  markdown: '## ok',
});

const skipped: ReviewOutcome = {
  status: ReviewStatus.SKIPPED,
  ref: TEST_REF,
  headSha: 'head222',
  reason: 'trivial',
  costUsd: 0,
  markdown: '## skipped',
};

const setup = (outcome: ReviewOutcome, current = buildPullRequest()) => {
  const published: { sha: string; report: CheckReport }[] = [];
  const publisher: CheckRunPublisherPort = {
    publish: async (_ref, sha, report) => {
      published.push({ sha, report });
    },
  };
  const reviews = { review: jest.fn().mockResolvedValue(outcome) } as unknown as ReviewService;
  const service = new ReviewJobService(reviews, buildFakeCodeHost({ pr: current }), publisher);
  return { service, published, review: reviews.review as jest.Mock };
};

describe('ReviewJobService', () => {
  it('publishes a neutral check for the reviewed commit', async () => {
    const { service, published } = setup(reviewed());
    expect(await service.process(JOB)).toBe(ReviewJobResult.PUBLISHED);
    expect(published).toHaveLength(1);
    expect(published[0]?.sha).toBe('head222');
    expect(published[0]?.report.conclusion).toBe('neutral');
  });

  it.each([
    ['closed', buildPullRequest({ state: PullRequestState.CLOSED })],
    ['merged', buildPullRequest({ state: PullRequestState.CLOSED, merged: true })],
    ['a newer head commit', buildPullRequest({ headSha: 'newer999' })],
  ])('does not publish when the pull request is %s', async (_name, current) => {
    const { service, published } = setup(reviewed(), current);
    expect(await service.process(JOB)).toBe(ReviewJobResult.NOT_PUBLISHED);
    expect(published).toHaveLength(0);
  });

  it('asks the review for an explicit pass only when a collaborator commanded it', async () => {
    const outcomes = setup(reviewed());
    await outcomes.service.process(JOB);
    await outcomes.service.process({ ...JOB, source: ReviewJobSource.COMMAND, commentId: 4 });
    expect(outcomes.review.mock.calls.map((call) => call[2])).toEqual([
      { explicitRequest: false },
      { explicitRequest: true },
    ]);
  });

  it('stays silent about a skipped pull request unless a collaborator asked', async () => {
    const silent = setup(skipped);
    expect(await silent.service.process(JOB)).toBe(ReviewJobResult.SKIPPED_SILENTLY);
    expect(silent.published).toHaveLength(0);

    const asked = setup(skipped);
    const result = await asked.service.process({
      ...JOB,
      source: ReviewJobSource.COMMAND,
      headSha: null,
      commentId: 3,
    });
    expect(result).toBe(ReviewJobResult.PUBLISHED);
    expect(asked.published[0]?.report.title).toBe(CheckVoice.TRIVIAL);
    expect(asked.published[0]?.report.summary.split('\n')[0]).toBe(CheckVoice.TRIVIAL);
  });
});
