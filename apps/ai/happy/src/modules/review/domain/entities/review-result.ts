import type { Severity } from '../constants/severity.constants';

import type { CoverageGap, ReviewStatus } from './review-outcome';

export interface ResultCoverage {
  complete: boolean;
  unreviewedFiles: number;
  gaps: CoverageGap[];
}

export interface ReviewResultSnapshot {
  status: ReviewStatus;
  title: string;
  summary: string;
  skipReason: string | null;
  counts: Record<Severity, number>;
  questions: { file: string; line: number; text: string }[];
  coverage: ResultCoverage;
}

export const UNKNOWN_RESULT_STATUS = 'unknown';

export interface PublishedReviewResult extends Omit<ReviewResultSnapshot, 'status'> {
  status: ReviewStatus | typeof UNKNOWN_RESULT_STATUS;
  checkedSha: string;
  current: boolean;
  checkRunUrl: string | null;
}
