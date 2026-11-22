import type { Severity } from '../constants/severity.constants';

import type { CoverageGap, ReviewStatus } from './review-outcome';
import type { FullReviewReason, ReviewMode } from './review-scope';
import type { StatusCounts, TrackedFinding } from './tracked-finding';

export interface ResultCoverage {
  complete: boolean;
  unreviewedFiles: number;
  gaps: CoverageGap[];
}

export interface ResultScope {
  mode: ReviewMode;
  baseSha: string | null;
  reason: FullReviewReason | null;
  files: number;
}

export interface ResultTracking {
  reviewedSha: string;
  scope: ResultScope;
  counts: StatusCounts;
  findings: TrackedFinding[];
}

export interface ReviewResultSnapshot {
  status: ReviewStatus;
  title: string;
  summary: string;
  skipReason: string | null;
  counts: Record<Severity, number>;
  questions: { file: string; line: number; text: string }[];
  coverage: ResultCoverage;
  tracking: ResultTracking | null;
}

export const UNKNOWN_RESULT_STATUS = 'unknown';

export interface PublishedReviewResult extends Omit<ReviewResultSnapshot, 'status'> {
  status: ReviewStatus | typeof UNKNOWN_RESULT_STATUS;
  checkedSha: string;
  current: boolean;
  checkRunUrl: string | null;
}
