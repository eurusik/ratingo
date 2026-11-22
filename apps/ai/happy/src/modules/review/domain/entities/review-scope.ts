export const RequestedMode = {
  AUTO: 'auto',
  FULL: 'full',
} as const;
export type RequestedMode = (typeof RequestedMode)[keyof typeof RequestedMode];

export const ReviewMode = {
  INCREMENTAL: 'incremental',
  FULL: 'full',
} as const;
export type ReviewMode = (typeof ReviewMode)[keyof typeof ReviewMode];

export const FullReviewReason = {
  NO_PREVIOUS: 'no_previous',
  REQUESTED: 'requested',
  HISTORY_REWRITTEN: 'history_rewritten',
  COMPARE_FAILED: 'compare_failed',
  PREVIOUS_UNREADABLE: 'previous_unreadable',
  PREVIOUS_INCOMPLETE: 'previous_incomplete',
} as const;
export type FullReviewReason = (typeof FullReviewReason)[keyof typeof FullReviewReason];

export const FULL_REVIEW_REASONS = Object.values(FullReviewReason) as [
  FullReviewReason,
  ...FullReviewReason[],
];

export type ReviewScope =
  | { mode: typeof ReviewMode.INCREMENTAL; baseSha: string }
  | { mode: typeof ReviewMode.FULL; reason: FullReviewReason };

export const ComparisonState = {
  AHEAD: 'ahead',
  DIVERGED: 'diverged',
  FAILED: 'failed',
} as const;
export type ComparisonState = (typeof ComparisonState)[keyof typeof ComparisonState];
