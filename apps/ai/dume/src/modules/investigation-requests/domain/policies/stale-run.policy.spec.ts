import {
  FailureReason,
  MAX_WAITING_REQUESTS,
  RequestState,
  SNAPSHOT_PHASE_ALLOWANCE_MS,
  STALE_RUNNING_MARGIN_MS,
} from '../constants/request.constants';
import { NOW_MS, queuedRecord } from '../../testing/investigation-requests.testing';

import { interruptedIfStale } from './stale-run.policy';

const TIMEOUT_MS = 240_000;
const running = queuedRecord({
  state: RequestState.RUNNING,
  startedAtMs: NOW_MS,
  runStartedAtMs: NOW_MS + 90_000,
});
const downloading = queuedRecord({ state: RequestState.RUNNING, startedAtMs: NOW_MS });

describe('interruptedIfStale', () => {
  it('counts the run time from when the code was ready, not from when the worker picked it up', () => {
    const afterSlowDownload = running.runStartedAtMs! + TIMEOUT_MS;

    expect(afterSlowDownload - running.startedAtMs!).toBeGreaterThan(
      TIMEOUT_MS + STALE_RUNNING_MARGIN_MS,
    );
    expect(interruptedIfStale(running, afterSlowDownload, TIMEOUT_MS)).toBe(running);
  });

  it('keeps a run inside its timeout and the margin after it', () => {
    const at = running.runStartedAtMs! + TIMEOUT_MS + STALE_RUNNING_MARGIN_MS;

    expect(interruptedIfStale(running, at, TIMEOUT_MS)).toBe(running);
  });

  it('reports a run past its timeout and margin as interrupted', () => {
    const at = running.runStartedAtMs! + TIMEOUT_MS + STALE_RUNNING_MARGIN_MS + 1;

    expect(interruptedIfStale(running, at, TIMEOUT_MS)).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.INTERRUPTED,
      finishedAtMs: at,
    });
  });

  it('gives the code download its own allowance before the run clock starts', () => {
    expect(interruptedIfStale(downloading, NOW_MS + SNAPSHOT_PHASE_ALLOWANCE_MS, TIMEOUT_MS)).toBe(
      downloading,
    );
    expect(
      interruptedIfStale(downloading, NOW_MS + SNAPSHOT_PHASE_ALLOWANCE_MS + 1, TIMEOUT_MS),
    ).toMatchObject({ reason: FailureReason.INTERRUPTED });
  });

  it('keeps a queued request while it can still be waiting behind the others', () => {
    const queued = queuedRecord();
    const longestWait =
      (SNAPSHOT_PHASE_ALLOWANCE_MS + TIMEOUT_MS + STALE_RUNNING_MARGIN_MS) *
      (MAX_WAITING_REQUESTS + 1);

    expect(interruptedIfStale(queued, NOW_MS + longestWait, TIMEOUT_MS)).toBe(queued);
    expect(interruptedIfStale(queued, NOW_MS + longestWait + 1, TIMEOUT_MS)).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.INTERRUPTED,
    });
  });

  it.each([RequestState.ANSWERED, RequestState.FAILED])('never changes a %s request', (state) => {
    const record = queuedRecord({ state, startedAtMs: NOW_MS });

    expect(interruptedIfStale(record, NOW_MS * 2, TIMEOUT_MS)).toBe(record);
  });
});
