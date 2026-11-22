import type { PullRequestRef } from './pull-request';

export const ReviewJobSource = {
  PULL_REQUEST: 'pull_request',
  COMMAND: 'command',
} as const;
export type ReviewJobSource = (typeof ReviewJobSource)[keyof typeof ReviewJobSource];

export interface ReviewJob {
  ref: PullRequestRef;
  source: ReviewJobSource;
  headSha: string | null;
  commentId: number | null;
}
