import { RunStopReason } from '@ratingo/ai-core';

import { InvestigationStatus, type InvestigationOutcome } from '../../../investigation/public';
import { FailureReason, RequestState } from '../../domain/constants/request.constants';
import type { InvestigationRecord } from '../../domain/entities/investigation-record';

const STOP_REASON_FAILURES: Readonly<Partial<Record<string, FailureReason>>> = {
  [RunStopReason.BUDGET_EXCEEDED]: FailureReason.BUDGET_STOP,
  [RunStopReason.TIMEOUT]: FailureReason.TIMEOUT,
  [RunStopReason.MODEL_ERROR]: FailureReason.MODEL_ERROR,
  [RunStopReason.UNEXPECTED_ERROR]: FailureReason.MODEL_ERROR,
};

const failureFor = (outcome: InvestigationOutcome): FailureReason => {
  if (outcome.status === InvestigationStatus.SNAPSHOT_UNAVAILABLE) {
    return FailureReason.CODE_UNAVAILABLE;
  }
  return STOP_REASON_FAILURES[outcome.stopReason ?? ''] ?? FailureReason.NO_VALID_ANSWER;
};

const runIdOf = (outcome: InvestigationOutcome): { runId?: string } =>
  outcome.runId === null ? {} : { runId: outcome.runId };

export const finishRecord = (
  record: InvestigationRecord,
  outcome: InvestigationOutcome,
  repository: string,
  finishedAtMs: number,
): InvestigationRecord => {
  if (
    outcome.status === InvestigationStatus.ANSWERED &&
    outcome.answer !== null &&
    outcome.commit !== null
  ) {
    return {
      ...record,
      state: RequestState.ANSWERED,
      ...runIdOf(outcome),
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
  return {
    ...record,
    state: RequestState.FAILED,
    reason: failureFor(outcome),
    ...runIdOf(outcome),
    finishedAtMs,
  };
};

export const failRecord = (
  record: InvestigationRecord,
  reason: FailureReason,
  finishedAtMs: number,
): InvestigationRecord => ({ ...record, state: RequestState.FAILED, reason, finishedAtMs });
