import type { FindingKind } from '../constants/finding-classification.constants';
import type { FindingCategory, Severity } from '../constants/severity.constants';

export const FindingStatus = {
  NEW: 'new',
  STILL_OPEN: 'still_open',
  RESOLVED: 'resolved',
  NEEDS_RECHECK: 'needs_recheck',
} as const;
export type FindingStatus = (typeof FindingStatus)[keyof typeof FindingStatus];

export const FINDING_STATUSES = Object.values(FindingStatus) as [FindingStatus, ...FindingStatus[]];

export interface TrackedFinding {
  fingerprint: string;
  file: string;
  line: number;
  severity: Severity;
  category: FindingCategory;
  kind: FindingKind;
  message: string;
  excerpt: string;
  status: FindingStatus;
}

export interface StatusCounts {
  new: number;
  stillOpen: number;
  resolved: number;
  needsRecheck: number;
}

export const RecheckVerdict = {
  RESOLVED: 'resolved',
  STILL_OPEN: 'still_open',
} as const;
export type RecheckVerdict = (typeof RecheckVerdict)[keyof typeof RecheckVerdict];

export interface RecheckAnswer {
  fingerprint: string;
  verdict: RecheckVerdict;
}
