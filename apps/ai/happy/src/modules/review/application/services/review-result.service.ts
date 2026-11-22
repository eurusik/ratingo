import { Inject, Injectable } from '@nestjs/common';

import { RESULT_COMMIT_LOOKBACK } from '../../domain/constants/review-limits.constants';
import type { PullRequest, PullRequestRef } from '../../domain/entities/pull-request';
import {
  UNKNOWN_RESULT_STATUS,
  type PublishedReviewResult,
} from '../../domain/entities/review-result';
import {
  CODE_HOST_PORT,
  CodeHostError,
  type CodeHostPort,
} from '../../domain/ports/code-host.port';
import {
  PUBLISHED_CHECK_PORT,
  type PublishedCheck,
  type PublishedCheckPort,
} from '../../domain/ports/published-check.port';

const NOT_FOUND = 404;

export type ReviewLookup =
  | { status: 'not_found' }
  | { status: 'found'; headSha: string; result: PublishedReviewResult | null };

const toResult = (check: PublishedCheck, headSha: string): PublishedReviewResult => {
  const snapshot = check.snapshot;
  const base = {
    checkedSha: check.headSha,
    current: check.headSha === headSha,
    checkRunUrl: check.url,
  };
  return snapshot === null
    ? {
        ...base,
        status: UNKNOWN_RESULT_STATUS,
        title: check.title,
        summary: '',
        skipReason: null,
        counts: { critical: 0, major: 0, minor: 0, nit: 0 },
        questions: [],
        coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
      }
    : { ...base, ...snapshot };
};

@Injectable()
export class ReviewResultService {
  constructor(
    @Inject(CODE_HOST_PORT) private readonly host: CodeHostPort,
    @Inject(PUBLISHED_CHECK_PORT) private readonly checks: PublishedCheckPort,
  ) {}

  async latest(ref: PullRequestRef): Promise<ReviewLookup> {
    const pullRequest = await this.findPullRequest(ref);
    if (pullRequest === null) return { status: 'not_found' };
    const headSha = pullRequest.headSha;
    const published = await this.firstPublished(ref, headSha);
    return {
      status: 'found',
      headSha,
      result: published === null ? null : toResult(published, headSha),
    };
  }

  async hasResultFor(ref: PullRequestRef, sha: string): Promise<boolean> {
    return (await this.checks.findForCommit(ref, sha)) !== null;
  }

  async findPullRequest(ref: PullRequestRef): Promise<PullRequest | null> {
    try {
      return await this.host.getPullRequest(ref);
    } catch (error) {
      if (error instanceof CodeHostError && error.status === NOT_FOUND) return null;
      throw error;
    }
  }

  private async firstPublished(
    ref: PullRequestRef,
    headSha: string,
  ): Promise<PublishedCheck | null> {
    const atHead = await this.checks.findForCommit(ref, headSha);
    if (atHead !== null) return atHead;
    const earlier = (await this.checks.listRecentCommitShas(ref, RESULT_COMMIT_LOOKBACK)).filter(
      (sha) => sha !== headSha,
    );
    for (const sha of earlier) {
      const check = await this.checks.findForCommit(ref, sha);
      if (check !== null) return check;
    }
    return null;
  }
}
