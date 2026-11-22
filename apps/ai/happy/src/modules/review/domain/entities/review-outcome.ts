import type { SkipReason } from '../constants/skip-patterns.constants';

import type { DroppedFinding, ValidatedFinding } from './finding';
import type { PullRequestRef } from './pull-request';

export const ReviewStatus = {
  SKIPPED: 'skipped',
  REVIEWED: 'reviewed',
  INCOMPLETE: 'incomplete',
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export interface SkippedReview {
  status: typeof ReviewStatus.SKIPPED;
  ref: PullRequestRef;
  reason: SkipReason;
  costUsd: 0;
  markdown: string;
}

export interface CompletedReview {
  status: typeof ReviewStatus.REVIEWED | typeof ReviewStatus.INCOMPLETE;
  ref: PullRequestRef;
  headSha: string;
  summary: string;
  findings: ValidatedFinding[];
  dropped: DroppedFinding[];
  reviewedFiles: string[];
  stopReason: string;
  truncated: boolean;
  costUsd: number;
  markdown: string;
}

export type ReviewOutcome = SkippedReview | CompletedReview;
