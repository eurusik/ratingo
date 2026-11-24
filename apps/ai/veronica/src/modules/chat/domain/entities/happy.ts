export const HappySeverity = {
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
  NIT: 'nit',
} as const;
export type HappySeverity = (typeof HappySeverity)[keyof typeof HappySeverity];

export const HappyResultStatus = {
  REVIEWED: 'reviewed',
  INCOMPLETE: 'incomplete',
  SKIPPED: 'skipped',
  CHECKLIST: 'checklist',
  UNKNOWN: 'unknown',
} as const;
export type HappyResultStatus = (typeof HappyResultStatus)[keyof typeof HappyResultStatus];

export const HappyResultKind = {
  REVIEW: 'review',
  RELEASE_CHECKLIST: 'release_checklist',
} as const;
export type HappyResultKind = (typeof HappyResultKind)[keyof typeof HappyResultKind];

export const HappyReviewMode = {
  AUTO: 'auto',
  FULL: 'full',
} as const;
export type HappyReviewMode = (typeof HappyReviewMode)[keyof typeof HappyReviewMode];

export const HappyScopeMode = {
  INCREMENTAL: 'incremental',
  FULL: 'full',
} as const;
export type HappyScopeMode = (typeof HappyScopeMode)[keyof typeof HappyScopeMode];

export interface HappyStatusCounts {
  new: number;
  stillOpen: number;
  resolved: number;
  needsRecheck: number;
}

interface HappyReviewInfo {
  mode: HappyScopeMode;
  baseSha: string | null;
  fullReason: string | null;
  files: number;
  statusCounts: HappyStatusCounts;
}

export interface HappyQuestion {
  file: string;
  line: number;
  text: string;
}

export interface HappyResult {
  kind: HappyResultKind;
  status: HappyResultStatus;
  checkedSha: string;
  current: boolean;
  title: string;
  summary: string;
  skipReason: string | null;
  counts: Record<HappySeverity, number>;
  questions: HappyQuestion[];
  coverage: { complete: boolean; unreviewedFiles: number; gaps: string[] };
  checkRunUrl: string | null;
  review: HappyReviewInfo | null;
}

export const HappyLookupKind = {
  NOT_FOUND: 'not_found',
  FOUND: 'found',
} as const;

export type HappyLookup =
  | { kind: typeof HappyLookupKind.NOT_FOUND }
  | {
      kind: typeof HappyLookupKind.FOUND;
      headSha: string;
      baseBranch: string | null;
      headBranch: string | null;
      reviewPending: boolean;
      result: HappyResult | null;
    };

export const HappyRequestKind = {
  QUEUED: 'queued',
  ALREADY_RUNNING: 'already_running',
  ALREADY_REVIEWED: 'already_reviewed',
  SKIPPED: 'skipped',
  NOT_FOUND: 'not_found',
} as const;

export type HappyReviewRequest =
  | {
      kind:
        | typeof HappyRequestKind.QUEUED
        | typeof HappyRequestKind.ALREADY_RUNNING
        | typeof HappyRequestKind.ALREADY_REVIEWED;
      headSha: string;
    }
  | { kind: typeof HappyRequestKind.SKIPPED; reason: string }
  | { kind: typeof HappyRequestKind.NOT_FOUND };

export interface HappyFollowUp {
  chatId: string;
  pullNumber: number;
  headSha: string;
  attempt: number;
  mode?: HappyReviewMode;
}

export interface HappyOpenPullRequest {
  number: number;
  title: string;
  author: string;
  updatedAtMs: number;
}
