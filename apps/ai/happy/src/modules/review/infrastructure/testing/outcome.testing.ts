import type { ValidatedFinding } from '../../domain/entities/finding';
import type { ReviewTracking } from '../../domain/entities/review-outcome';
import { FullReviewReason, ReviewMode } from '../../domain/entities/review-scope';
import { FindingStatus } from '../../domain/entities/tracked-finding';
import { toTracked } from '../../domain/policies/finding-tracking';

export const trackingOf = (
  findings: readonly ValidatedFinding[],
  questions: readonly ValidatedFinding[] = [],
): ReviewTracking => ({
  scope: { mode: ReviewMode.FULL, reason: FullReviewReason.NO_PREVIOUS },
  reviewedFileCount: 0,
  hadPrevious: false,
  findings: [...findings, ...questions].map((finding) => toTracked(finding, FindingStatus.NEW)),
});
