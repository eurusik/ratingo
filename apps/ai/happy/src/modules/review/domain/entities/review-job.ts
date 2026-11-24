import type { PullRequestRef } from './pull-request';
import type { RequestedMode } from './review-scope';

export const ReviewJobSource = {
  PULL_REQUEST: 'pull_request',
  COMMAND: 'command',
  INTERNAL_REQUEST: 'internal_request',
} as const;
export type ReviewJobSource = (typeof ReviewJobSource)[keyof typeof ReviewJobSource];

export interface ReviewJob {
  ref: PullRequestRef;
  source: ReviewJobSource;
  headSha: string | null;
  commentId: number | null;
  mode?: RequestedMode;
}
