import type { FindingKind, FindingTopic } from '../constants/finding-classification.constants';
import type { FindingCategory, Severity } from '../constants/severity.constants';

export interface FindingEvidence {
  path: string;
  line: number;
  excerpt: string;
}

export interface Finding {
  file: string;
  line: number;
  severity: Severity;
  category: FindingCategory;
  topic: FindingTopic;
  kind: FindingKind;
  message: string;
  suggestion?: string;
  evidence: FindingEvidence;
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
  NOT_A_BUG: 'not_a_bug',
} as const;
export type FindingDropReason = (typeof FindingDropReason)[keyof typeof FindingDropReason];

export interface DroppedFinding {
  finding: Finding;
  reason: FindingDropReason;
  precedent?: string;
}

export interface FindingValidation {
  kept: ValidatedFinding[];
  questions: ValidatedFinding[];
  dropped: DroppedFinding[];
}
