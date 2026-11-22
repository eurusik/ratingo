import { CheckVoice, SKIPPED_TITLE_PREFIX } from '../constants/check-voice.constants';
import { SkipReason } from '../constants/skip-patterns.constants';
import { Severity } from '../constants/severity.constants';
import type { CompletedReview, ReviewOutcome } from '../entities/review-outcome';
import { isCoverageComplete, ReviewStatus } from '../entities/review-outcome';

const hasSeverity = (review: CompletedReview, severity: Severity): boolean =>
  review.findings.some((finding) => finding.severity === severity);

const isCoverageGap = (review: CompletedReview): boolean =>
  review.status === ReviewStatus.INCOMPLETE || !isCoverageComplete(review.coverage);

const completedVoice = (review: CompletedReview): string => {
  if (review.budgetExhausted) return CheckVoice.BUDGET_EXHAUSTED;
  if (hasSeverity(review, Severity.CRITICAL)) return CheckVoice.CRITICAL;
  if (hasSeverity(review, Severity.MAJOR)) return CheckVoice.MAJOR;
  if (isCoverageGap(review)) return CheckVoice.COVERAGE_GAP;
  if (review.findings.length > 0) return CheckVoice.MINOR;
  if (review.questions.length > 0) return CheckVoice.QUESTIONS;
  return CheckVoice.CLEAN;
};

const SKIPPED_VOICE: Partial<Record<SkipReason, string>> = {
  [SkipReason.TRIVIAL]: CheckVoice.TRIVIAL,
  [SkipReason.TOO_LARGE]: CheckVoice.TOO_LARGE,
};

const skippedVoice = (reason: SkipReason): string =>
  SKIPPED_VOICE[reason] ?? `${SKIPPED_TITLE_PREFIX}: ${reason}`;

export const checkVoiceLine = (outcome: ReviewOutcome): string => {
  switch (outcome.status) {
    case ReviewStatus.SKIPPED:
      return skippedVoice(outcome.reason);
    case ReviewStatus.CHECKLIST:
      return CheckVoice.RELEASE_CHECKLIST;
    case ReviewStatus.REVIEWED:
    case ReviewStatus.INCOMPLETE:
      return completedVoice(outcome);
  }
};
