export const DumeState = {
  QUEUED: 'queued',
  RUNNING: 'running',
  ANSWERED: 'answered',
  FAILED: 'failed',
} as const;
export type DumeState = (typeof DumeState)[keyof typeof DumeState];

export const DumeFailureReason = {
  BUDGET_STOP: 'budget_stop',
  TIMEOUT: 'timeout',
  MODEL_ERROR: 'model_error',
  NO_VALID_ANSWER: 'no_valid_answer',
  CODE_UNAVAILABLE: 'code_unavailable',
  DAY_BUDGET: 'day_budget',
  INTERRUPTED: 'interrupted',
  INTERNAL_ERROR: 'internal_error',
} as const;
export type DumeFailureReason = (typeof DumeFailureReason)[keyof typeof DumeFailureReason];

export const DumeRejectionReason = {
  DAY_BUDGET: 'day_budget',
  DAILY_COUNT_CAP: 'daily_count_cap',
  QUEUE_FULL: 'queue_full',
  OTHER: 'other',
} as const;
export type DumeRejectionReason = (typeof DumeRejectionReason)[keyof typeof DumeRejectionReason];

export const DumeSupport = {
  SUPPORTED: 'supported',
  PARTLY_SUPPORTED: 'partly_supported',
  UNSUPPORTED: 'unsupported',
  NO_CLAIMS: 'no_claims',
} as const;
export type DumeSupport = (typeof DumeSupport)[keyof typeof DumeSupport];

export interface DumeCitation {
  path: string;
  startLine: number;
  endLine: number;
}

interface DumeEvidence {
  ref: string;
  tool: string;
  summary: string;
}

export interface DumeFact {
  text: string;
  citations: readonly DumeCitation[];
  evidence: readonly DumeEvidence[];
}

interface DumeProblem {
  failure: string;
}

export interface DumeAssumption {
  text: string;
  origin: string;
  problems: readonly DumeProblem[];
}

interface DumeAnswer {
  answer: string;
  facts: readonly DumeFact[];
  assumptions: readonly DumeAssumption[];
  unknowns: readonly string[];
  support: DumeSupport;
}

export interface DumeResult {
  repository: string;
  ref: string;
  commit: string;
  turns: number;
  costUsd: number;
  answer: DumeAnswer;
}

export interface DumeRequestView {
  requestId: string;
  state: DumeState;
  reason?: DumeFailureReason;
  createdAtMs: number;
  startedAtMs?: number;
  finishedAtMs?: number;
  result?: DumeResult;
}

export interface DumeSubmission {
  requestId: string;
  question: string;
  ref: string;
}

export const DumeSubmitKind = {
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CONFLICT: 'conflict',
} as const;

export type DumeSubmitResult =
  | { kind: typeof DumeSubmitKind.ACCEPTED; created: boolean; request: DumeRequestView }
  | { kind: typeof DumeSubmitKind.REJECTED; reason: DumeRejectionReason }
  | { kind: typeof DumeSubmitKind.CONFLICT };

export type DumeLookup = { kind: 'found'; request: DumeRequestView } | { kind: 'not_found' };

export interface DumeFollowUp {
  chatId: string;
  requestId: string;
  createdAtMs: number;
  attempt: number;
}
