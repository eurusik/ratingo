import { Inject, Injectable } from '@nestjs/common';

import { RESULT_COMMIT_LOOKBACK } from '../../domain/constants/review-limits.constants';
import type {
  OpenPullRequest,
  PullRequest,
  PullRequestRef,
} from '../../domain/entities/pull-request';
import { ReviewStatus } from '../../domain/entities/review-outcome';
import { RequestedMode, ReviewMode } from '../../domain/entities/review-scope';
import {
  ResultKind,
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
  | {
      status: 'found';
      headSha: string;
      baseBranch: string;
      headBranch: string;
      result: PublishedReviewResult | null;
    };

const isFullyReviewed = (snapshot: PublishedCheck['snapshot']): boolean =>
  snapshot !== null &&
  (snapshot.tracking?.scope.mode === ReviewMode.FULL ||
    snapshot.kind === ResultKind.RELEASE_CHECKLIST ||
    snapshot.status === ReviewStatus.SKIPPED);

const toResult = (check: PublishedCheck, pullRequest: PullRequest): PublishedReviewResult => {
  const headSha = pullRequest.headSha;
  const snapshot = check.snapshot;
  const base = {
    checkedSha: check.headSha,
    current: check.headSha === headSha,
    checkRunUrl: check.url,
  };
  return snapshot === null
    ? {
        ...base,
        kind: ResultKind.REVIEW,
        status: UNKNOWN_RESULT_STATUS,
        title: check.title,
        summary: '',
        skipReason: null,
        counts: { critical: 0, major: 0, minor: 0, nit: 0 },
        questions: [],
        coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
        tracking: null,
        checklist: null,
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
      baseBranch: pullRequest.baseRef,
      headBranch: pullRequest.headRef,
      result: published === null ? null : toResult(published, pullRequest),
    };
  }

  listOpenPullRequests(
    repository: Pick<PullRequestRef, 'owner' | 'repo'>,
    limit: number,
  ): Promise<OpenPullRequest[]> {
    return this.host.listOpenPullRequests(repository, limit);
  }

  async hasResultFor(ref: PullRequestRef, sha: string, mode: RequestedMode): Promise<boolean> {
    const check = await this.checks.findForCommit(ref, sha);
    if (check === null) return false;
    if (mode === RequestedMode.AUTO) return true;
    return check.trusted && isFullyReviewed(check.snapshot);
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
