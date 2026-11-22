import type { PullRequestRef } from '../entities/pull-request';
import type { ReviewResultSnapshot } from '../entities/review-result';

export const PUBLISHED_CHECK_PORT = Symbol('PUBLISHED_CHECK_PORT');

export interface PublishedCheck {
  headSha: string;
  title: string;
  snapshot: ReviewResultSnapshot | null;
  url: string | null;
}

export interface PublishedCheckPort {
  findForCommit(ref: PullRequestRef, sha: string): Promise<PublishedCheck | null>;
  listRecentCommitShas(ref: PullRequestRef, limit: number): Promise<string[]>;
}
