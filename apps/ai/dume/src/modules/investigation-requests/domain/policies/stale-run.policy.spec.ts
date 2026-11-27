import { FailureReason, RequestState, STALE_RUNNING_MARGIN_MS } from '../constants/request.constants';

import { NOW_MS, queuedRecord } from '../../testing/investigation-requests.testing';

import { interruptedIfStale } from './stale-run.policy';

const TIMEOUT_MS = 240_000;
const running = queuedRecord({ state: RequestState.RUNNING, startedAtMs: NOW_MS });

describe('interruptedIfStale', () => {
  it('keeps a run that is still inside its timeout', () => {
    expect(interruptedIfStale(running, NOW_MS + TIMEOUT_MS, TIMEOUT_MS)).toBe(running);
  });

  it('keeps a run inside the margin after the timeout', () => {
    const at = NOW_MS + TIMEOUT_MS + STALE_RUNNING_MARGIN_MS;

    expect(interruptedIfStale(running, at, TIMEOUT_MS)).toBe(running);
  });

  it('reports a run past timeout and margin as interrupted', () => {
    const at = NOW_MS + TIMEOUT_MS + STALE_RUNNING_MARGIN_MS + 1;

    expect(interruptedIfStale(running, at, TIMEOUT_MS)).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.INTERRUPTED,
      finishedAtMs: at,
    });
  });

  it('keeps a queued request while it can still be waiting behind the others', () => {
    const queued = queuedRecord();
    const longestWait = TIMEOUT_MS * 3 + STALE_RUNNING_MARGIN_MS;

    expect(interruptedIfStale(queued, NOW_MS + longestWait, TIMEOUT_MS)).toBe(queued);
  });

  it('reports a queued request that has waited longer than any queue can take as interrupted', () => {
    const queued = queuedRecord();
    const at = NOW_MS + TIMEOUT_MS * 3 + STALE_RUNNING_MARGIN_MS + 1;

    expect(interruptedIfStale(queued, at, TIMEOUT_MS)).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.INTERRUPTED,
    });
  });

  it.each([RequestState.ANSWERED, RequestState.FAILED])(
    'never changes a %s request',
    (state) => {
      const record = queuedRecord({ state, startedAtMs: NOW_MS });

      expect(interruptedIfStale(record, NOW_MS * 2, TIMEOUT_MS)).toBe(record);
    },
  );
});
