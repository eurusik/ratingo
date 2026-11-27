import { InvestigationStatus } from '../../../investigation/public';
import { FailureReason, RequestState } from '../../domain/constants/request.constants';
import {
  NOW_MS,
  answeredOutcome,
  queuedRecord,
} from '../../testing/investigation-requests.testing';

import { failRecord, finishRecord } from './outcome-record.mapper';

const running = queuedRecord({ state: RequestState.RUNNING, startedAtMs: NOW_MS });
const finish = (outcome: ReturnType<typeof answeredOutcome>) =>
  finishRecord(running, outcome, 'eurusik/ratingo', NOW_MS + 5);

describe('finishRecord', () => {
  it('keeps the verified answer, commit and cost of an answered run', () => {
    const record = finish(answeredOutcome());

    expect(record.state).toBe(RequestState.ANSWERED);
    expect(record.result).toMatchObject({
      repository: 'eurusik/ratingo',
      ref: 'main',
      commit: 'a'.repeat(40),
      turns: 7,
      costUsd: 0.08,
    });
    expect(record.result?.answer.facts).toHaveLength(1);
    expect(record.finishedAtMs).toBe(NOW_MS + 5);
  });

  it.each([
    ['budget_exceeded', FailureReason.BUDGET_STOP],
    ['timeout', FailureReason.TIMEOUT],
    ['model_error', FailureReason.MODEL_ERROR],
    ['unexpected_error', FailureReason.MODEL_ERROR],
    ['max_turns', FailureReason.NO_VALID_ANSWER],
    [null, FailureReason.NO_VALID_ANSWER],
  ])('fails an unanswered run stopped by %s as %s', (stopReason, reason) => {
    const record = finish(
      answeredOutcome({ status: InvestigationStatus.UNANSWERED, answer: null, stopReason }),
    );

    expect(record).toMatchObject({ state: RequestState.FAILED, reason });
    expect(record.result).toBeUndefined();
  });

  it('fails a run whose code could not be fetched with its own reason', () => {
    const record = finish(
      answeredOutcome({
        status: InvestigationStatus.SNAPSHOT_UNAVAILABLE,
        answer: null,
        commit: null,
      }),
    );

    expect(record).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.CODE_UNAVAILABLE,
    });
  });
});

describe('failRecord', () => {
  it('marks the request failed with the reason and the time', () => {
    expect(failRecord(running, FailureReason.INTERRUPTED, NOW_MS + 9)).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.INTERRUPTED,
      finishedAtMs: NOW_MS + 9,
    });
  });
});
