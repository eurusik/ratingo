import {
  InvestigationStatus,
  type InvestigationOutcome,
} from '../../../investigation/public';
import { FailureReason, RequestState } from '../../domain/constants/request.constants';
import type { InvestigationRecord } from '../../domain/entities/investigation-record';

const STOP_REASON_FAILURES: Readonly<Record<string, FailureReason>> = {
  budget_exceeded: FailureReason.BUDGET_STOP,
  timeout: FailureReason.TIMEOUT,
  model_error: FailureReason.MODEL_ERROR,
  unexpected_error: FailureReason.MODEL_ERROR,
};

const failureFor = (outcome: InvestigationOutcome): FailureReason => {
  if (outcome.status === InvestigationStatus.SNAPSHOT_UNAVAILABLE) {
    return FailureReason.CODE_UNAVAILABLE;
  }
  return STOP_REASON_FAILURES[outcome.stopReason ?? ''] ?? FailureReason.NO_VALID_ANSWER;
};

export const finishRecord = (
  record: InvestigationRecord,
  outcome: InvestigationOutcome,
  repository: string,
  finishedAtMs: number,
): InvestigationRecord => {
  if (outcome.status === InvestigationStatus.ANSWERED && outcome.answer !== null && outcome.commit !== null) {
    return {
      ...record,
      state: RequestState.ANSWERED,
      finishedAtMs,
      result: {
        repository,
        ref: outcome.ref,
        commit: outcome.commit,
        turns: outcome.turns,
        costUsd: outcome.costUsd,
        answer: outcome.answer,
      },
    };
  }
  return { ...record, state: RequestState.FAILED, reason: failureFor(outcome), finishedAtMs };
};

export const failRecord = (
  record: InvestigationRecord,
  reason: FailureReason,
  finishedAtMs: number,
): InvestigationRecord => ({ ...record, state: RequestState.FAILED, reason, finishedAtMs });
