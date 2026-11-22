import { Inject, Injectable } from '@nestjs/common';

import { REVIEW_CONFIG, type ReviewConfig } from '../../../../config/config.constants';
import {
  ReviewJobSource,
  ReviewResultService,
  parseRepository,
  type OpenPullRequest,
  type PullRequestRef,
  type ReviewLookup,
} from '../../../review/public';
import {
  InternalRequestStatus,
  OPEN_PULL_REQUESTS_LIMIT,
  type InternalSkipReason,
} from '../../domain/constants/webhook.constants';
import { decideInternalRequest } from '../../domain/policies/internal-request-policy';
import {
  EnqueueState,
  REVIEW_QUEUE_PORT,
  type ReviewQueuePort,
} from '../../domain/ports/review-queue.port';

export type ReviewRequestResult =
  | {
      status:
        | typeof InternalRequestStatus.QUEUED
        | typeof InternalRequestStatus.ALREADY_RUNNING
        | typeof InternalRequestStatus.ALREADY_REVIEWED;
      headSha: string;
    }
  | { status: typeof InternalRequestStatus.SKIPPED; reason: InternalSkipReason }
  | { status: typeof InternalRequestStatus.NOT_FOUND };

export type PullReviewState = ReviewLookup & { reviewPending?: boolean };

export class RepositoryNotConfiguredError extends Error {
  constructor() {
    super('No valid repository is configured for internal reviews');
    this.name = 'RepositoryNotConfiguredError';
  }
}

@Injectable()
export class InternalReviewService {
  constructor(
    @Inject(REVIEW_CONFIG) private readonly config: ReviewConfig,
    @Inject(REVIEW_QUEUE_PORT) private readonly queue: ReviewQueuePort,
    private readonly results: ReviewResultService,
  ) {}

  async request(pullNumber: number): Promise<ReviewRequestResult> {
    const ref = this.refFor(pullNumber);
    const pullRequest = await this.results.findPullRequest(ref);
    if (pullRequest === null) return { status: InternalRequestStatus.NOT_FOUND };
    const skipReason = decideInternalRequest(pullRequest, {
      repositoryName: `${ref.owner}/${ref.repo}`,
      allowedAuthors: this.config.allowedAuthors,
    });
    if (skipReason !== null) return { status: InternalRequestStatus.SKIPPED, reason: skipReason };
    const headSha = pullRequest.headSha;
    if (await this.results.hasResultFor(ref, headSha)) {
      return { status: InternalRequestStatus.ALREADY_REVIEWED, headSha };
    }
    const state = await this.queue.enqueue({
      ref,
      source: ReviewJobSource.INTERNAL_REQUEST,
      headSha,
      commentId: null,
    });
    return { status: statusFor(state), headSha };
  }

  listOpen(): Promise<OpenPullRequest[]> {
    const { owner, repo } = this.refFor(0);
    return this.results.listOpenPullRequests({ owner, repo }, OPEN_PULL_REQUESTS_LIMIT);
  }

  async latest(pullNumber: number): Promise<PullReviewState> {
    const ref = this.refFor(pullNumber);
    const lookup = await this.results.latest(ref);
    if (lookup.status === 'not_found') return lookup;
    if (lookup.result?.current === true) return { ...lookup, reviewPending: false };
    return { ...lookup, reviewPending: await this.isReviewPending(ref, lookup.headSha) };
  }

  private async isReviewPending(ref: PullRequestRef, headSha: string): Promise<boolean> {
    const sources = [ReviewJobSource.INTERNAL_REQUEST, ReviewJobSource.PULL_REQUEST];
    const pending = await Promise.all(
      sources.map((source) => this.queue.isPending({ ref, source, headSha, commentId: null })),
    );
    return pending.some(Boolean);
  }

  private refFor(pullNumber: number): PullRequestRef {
    const repository = parseRepository(this.config.allowedRepositories[0] ?? '');
    if (repository === null) throw new RepositoryNotConfiguredError();
    return { ...repository, number: pullNumber };
  }
}

const statusFor = (
  state: EnqueueState,
):
  | typeof InternalRequestStatus.QUEUED
  | typeof InternalRequestStatus.ALREADY_RUNNING
  | typeof InternalRequestStatus.ALREADY_REVIEWED => {
  switch (state) {
    case EnqueueState.QUEUED:
      return InternalRequestStatus.QUEUED;
    case EnqueueState.PENDING:
      return InternalRequestStatus.ALREADY_RUNNING;
    case EnqueueState.FINISHED:
      return InternalRequestStatus.ALREADY_REVIEWED;
  }
};
