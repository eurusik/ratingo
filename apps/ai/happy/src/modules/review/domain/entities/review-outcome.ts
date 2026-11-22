import type { SkipReason } from '../constants/skip-patterns.constants';

import type { DroppedFinding, ValidatedFinding } from './finding';
import type { PullRequestRef } from './pull-request';
import type { ReviewScope } from './review-scope';
import type { TrackedFinding } from './tracked-finding';

export const ReviewStatus = {
  SKIPPED: 'skipped',
  REVIEWED: 'reviewed',
  INCOMPLETE: 'incomplete',
  CHECKLIST: 'checklist',
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const CoverageGap = {
  LISTING_TRUNCATED: 'listing_truncated',
  STOPPED_EARLY: 'stopped_early',
  TOOL_FAILED: 'tool_failed',
  DIFFS_NOT_INLINED: 'diffs_not_inlined',
  EVIDENCE_UNREADABLE: 'evidence_unreadable',
} as const;
export type CoverageGap = (typeof CoverageGap)[keyof typeof CoverageGap];

export interface ReviewCoverage {
  unreviewedFiles: string[];
  gaps: CoverageGap[];
}

export interface SkippedReview {
  status: typeof ReviewStatus.SKIPPED;
  ref: PullRequestRef;
  headSha: string;
  reason: SkipReason;
  costUsd: 0;
  markdown: string;
}

export interface ReviewTracking {
  scope: ReviewScope;
  reviewedFileCount: number;
  hadPrevious: boolean;
  findings: TrackedFinding[];
}

export interface CompletedReview {
  status: typeof ReviewStatus.REVIEWED | typeof ReviewStatus.INCOMPLETE;
  ref: PullRequestRef;
  headSha: string;
  summary: string;
  findings: ValidatedFinding[];
  questions: ValidatedFinding[];
  dropped: DroppedFinding[];
  tracking: ReviewTracking;
  reviewedFiles: string[];
  coverage: ReviewCoverage;
  stopReason: string;
  budgetExhausted: boolean;
  costUsd: number;
  markdown: string;
}

export interface ReleaseChecklistReview {
  status: typeof ReviewStatus.CHECKLIST;
  ref: PullRequestRef;
  headSha: string;
  costUsd: 0;
  markdown: string;
}

export type ReviewOutcome = SkippedReview | CompletedReview | ReleaseChecklistReview;

export const isCoverageComplete = (coverage: ReviewCoverage): boolean =>
  coverage.gaps.length === 0 && coverage.unreviewedFiles.length === 0;
