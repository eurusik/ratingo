import type { VerifiedAnswer } from '../../../investigation/public';
import type { FailureReason, RequestState } from '../constants/request.constants';

interface InvestigationResult {
  repository: string;
  ref: string;
  commit: string;
  turns: number;
  costUsd: number;
  answer: VerifiedAnswer;
}

export interface InvestigationRecord {
  version: number;
  requestId: string;
  question: string;
  ref: string;
  state: RequestState;
  reason?: FailureReason;
  createdAtMs: number;
  startedAtMs?: number;
  finishedAtMs?: number;
  result?: InvestigationResult;
}
