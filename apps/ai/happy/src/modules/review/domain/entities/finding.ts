import type { FindingCategory, Severity } from '../constants/severity.constants';

export interface Finding {
  file: string;
  line: number;
  severity: Severity;
  category: FindingCategory;
  message: string;
  suggestion?: string;
}

export interface ValidatedFinding extends Finding {
  fingerprint: string;
}

export const FindingDropReason = {
  FILE_NOT_IN_DIFF: 'file_not_in_diff',
  LINE_NOT_IN_DIFF: 'line_not_in_diff',
  DUPLICATE: 'duplicate',
  OVER_CAP: 'over_cap',
  EMPTY_MESSAGE: 'empty_message',
} as const;
export type FindingDropReason = (typeof FindingDropReason)[keyof typeof FindingDropReason];

export interface DroppedFinding {
  finding: Finding;
  reason: FindingDropReason;
}

export interface FindingValidation {
  kept: ValidatedFinding[];
  dropped: DroppedFinding[];
}
