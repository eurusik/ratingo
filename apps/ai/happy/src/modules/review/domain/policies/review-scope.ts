import {
  ComparisonState,
  FullReviewReason,
  RequestedMode,
  ReviewMode,
  type ReviewScope,
} from '../entities/review-scope';
import type { TrackedFinding } from '../entities/tracked-finding';

export const PreviousReviewKind = {
  NONE: 'none',
  UNREADABLE: 'unreadable',
  STATE: 'state',
} as const;

export type PreviousReview =
  | { kind: typeof PreviousReviewKind.NONE }
  | { kind: typeof PreviousReviewKind.UNREADABLE }
  | {
      kind: typeof PreviousReviewKind.STATE;
      reviewedSha: string;
      complete: boolean;
      findings: readonly TrackedFinding[];
    };

export type ScopeStep =
  { action: 'full'; reason: FullReviewReason } | { action: 'compare'; baseSha: string };

const full = (reason: FullReviewReason): ScopeStep => ({ action: 'full', reason });

export const planReviewScope = (requested: RequestedMode, previous: PreviousReview): ScopeStep => {
  if (requested === RequestedMode.FULL) return full(FullReviewReason.REQUESTED);
  switch (previous.kind) {
    case PreviousReviewKind.NONE:
      return full(FullReviewReason.NO_PREVIOUS);
    case PreviousReviewKind.UNREADABLE:
      return full(FullReviewReason.PREVIOUS_UNREADABLE);
    case PreviousReviewKind.STATE:
      return previous.complete
        ? { action: 'compare', baseSha: previous.reviewedSha }
        : full(FullReviewReason.PREVIOUS_INCOMPLETE);
  }
};

export const resolveScope = (baseSha: string, comparison: ComparisonState): ReviewScope => {
  switch (comparison) {
    case ComparisonState.AHEAD:
      return { mode: ReviewMode.INCREMENTAL, baseSha };
    case ComparisonState.DIVERGED:
      return { mode: ReviewMode.FULL, reason: FullReviewReason.HISTORY_REWRITTEN };
    case ComparisonState.FAILED:
      return { mode: ReviewMode.FULL, reason: FullReviewReason.COMPARE_FAILED };
  }
};
