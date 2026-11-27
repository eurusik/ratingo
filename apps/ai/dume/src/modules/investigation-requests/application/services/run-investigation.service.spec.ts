import { Logger } from '@nestjs/common';

import { FixedClock } from '@ratingo/ai-core';

import type { InvestigationService } from '../../../investigation/public';
import { InvestigationStatus } from '../../../investigation/public';
import { FailureReason, RequestState } from '../../domain/constants/request.constants';
import {
  FakeDayLimits,
  InMemoryRequestStore,
  NOW_MS,
  answeredOutcome,
  queuedRecord,
} from '../../testing/investigation-requests.testing';

import { RunInvestigationService, RunResult } from './run-investigation.service';

const setup = (investigate: jest.Mock, finalSaveDelaysMs: readonly number[] = [0, 0]) => {
  const store = new InMemoryRequestStore();
  const limits = new FakeDayLimits();
  const service = new RunInvestigationService(
    store,
    limits,
    { kind: 'github', repository: 'eurusik/ratingo', apiUrl: 'https://api.github.com' },
    new FixedClock(NOW_MS),
    { investigate } as unknown as InvestigationService,
    finalSaveDelaysMs,
  );
  return { store, limits, service };
};

describe('RunInvestigationService', () => {
  it('runs the stored question on the stored ref and keeps the answer', async () => {
    const investigate = jest.fn().mockResolvedValue(answeredOutcome());
    const { service, store } = setup(investigate);
    await store.seed(queuedRecord({ ref: 'development' }));

    expect(await service.run('tg1000001')).toBe(RunResult.FINISHED);

    expect(investigate).toHaveBeenCalledWith(
      expect.objectContaining({ question: 'Why does sync-show time out?', ref: 'development' }),
    );
    expect(store.records.get('tg1000001')).toMatchObject({
      state: RequestState.ANSWERED,
      startedAtMs: NOW_MS,
    });
  });

  it('marks the request running before the investigation starts', async () => {
    const seen: RequestState[] = [];
    const { service, store } = setup(
      jest.fn().mockImplementation(async () => {
        seen.push(store.records.get('tg1000001')?.state as RequestState);
        return answeredOutcome();
      }),
    );
    await store.seed(queuedRecord());

    await service.run('tg1000001');

    expect(seen).toEqual([RequestState.RUNNING]);
  });

  it('records why an unanswered run failed', async () => {
    const investigate = jest.fn().mockResolvedValue(
      answeredOutcome({
        status: InvestigationStatus.UNANSWERED,
        answer: null,
        stopReason: 'timeout',
      }),
    );
    const { service, store } = setup(investigate);
    await store.seed(queuedRecord());

    await service.run('tg1000001');

    expect(store.records.get('tg1000001')).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.TIMEOUT,
    });
  });

  it('records an exception as an internal error and never throws it into the queue', async () => {
    const { service, store } = setup(jest.fn().mockRejectedValue(new Error('boom')));
    await store.seed(queuedRecord());

    expect(await service.run('tg1000001')).toBe(RunResult.FAILED);

    expect(store.records.get('tg1000001')).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.INTERNAL_ERROR,
    });
  });

  it('fails a request without calling the model when the day budget is already spent', async () => {
    const investigate = jest.fn();
    const { service, store, limits } = setup(investigate);
    await store.seed(queuedRecord());
    limits.spent = limits.budget;

    await service.run('tg1000001');

    expect(investigate).not.toHaveBeenCalled();
    expect(store.records.get('tg1000001')?.reason).toBe(FailureReason.DAY_BUDGET);
  });

  it.each([RequestState.ANSWERED, RequestState.FAILED])(
    'does not run a %s request again',
    async (state) => {
      const investigate = jest.fn();
      const { service, store } = setup(investigate);
      await store.seed(queuedRecord({ state }));

      expect(await service.run('tg1000001')).toBe(RunResult.SKIPPED);
      expect(investigate).not.toHaveBeenCalled();
    },
  );

  it('ignores a job whose request is gone', async () => {
    const { service } = setup(jest.fn());

    expect(await service.run('tg1000009')).toBe(RunResult.MISSING);
  });

  it('marks a stalled request interrupted but leaves a finished one alone', async () => {
    const { service, store } = setup(jest.fn());
    await store.seed(queuedRecord({ state: RequestState.RUNNING }));
    await store.seed(queuedRecord({ requestId: 'tg1000002', state: RequestState.ANSWERED }));

    await service.markInterrupted('tg1000001');
    await service.markInterrupted('tg1000002');

    expect(store.records.get('tg1000001')?.reason).toBe(FailureReason.INTERRUPTED);
    expect(store.records.get('tg1000002')?.state).toBe(RequestState.ANSWERED);
  });

  it('keeps the run id of the finished investigation in the record', async () => {
    const { service, store } = setup(jest.fn().mockResolvedValue(answeredOutcome()));
    await store.seed(queuedRecord());

    await service.run('tg1000001');

    expect(store.records.get('tg1000001')?.runId).toBe('run-1');
  });

  it('retries the final save and still delivers the answer when the store comes back', async () => {
    const { service, store } = setup(jest.fn().mockResolvedValue(answeredOutcome()), [0, 0, 0]);
    await store.seed(queuedRecord());
    const realFinish = store.finish.bind(store);
    let calls = 0;
    store.finish = async (record) => {
      calls += 1;
      if (calls < 3) throw new Error('redis timeout');
      return realFinish(record);
    };

    expect(await service.run('tg1000001')).toBe(RunResult.FINISHED);
    expect(calls).toBe(3);
    expect(store.records.get('tg1000001')?.state).toBe(RequestState.ANSWERED);
  });

  it('fails the job, with the run id and the cost in the log, when the final save never works', async () => {
    const { service, store } = setup(jest.fn().mockResolvedValue(answeredOutcome()), [0, 0]);
    await store.seed(queuedRecord());
    store.finish = async () => {
      throw new Error('redis down');
    };
    const errors: unknown[] = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((entry) => void errors.push(entry));

    await expect(service.run('tg1000001')).rejects.toThrow('redis down');

    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'investigation_request.save_failed',
        requestId: 'tg1000001',
        runId: 'run-1',
        costUsd: 0.08,
      }),
    );
  });

  it('never replaces an answer that is already stored', async () => {
    const { service, store } = setup(jest.fn().mockRejectedValue(new Error('late failure')));
    await store.seed(queuedRecord());
    const answered = { ...queuedRecord(), state: RequestState.ANSWERED };
    const realTransition = store.transition.bind(store);
    store.transition = async (record, from) => {
      const moved = await realTransition(record, from);
      if (record.state === RequestState.RUNNING) await store.seed(answered);
      return moved;
    };

    await service.run('tg1000001');

    expect(store.records.get('tg1000001')?.state).toBe(RequestState.ANSWERED);
  });

  it('starts the run clock when the code is ready, not before', async () => {
    const seen: (number | undefined)[] = [];
    const { service, store } = setup(
      jest.fn().mockImplementation(async (request: { onSnapshotReady: () => Promise<void> }) => {
        seen.push(store.records.get('tg1000001')?.runStartedAtMs);
        await request.onSnapshotReady();
        seen.push(store.records.get('tg1000001')?.runStartedAtMs);
        return answeredOutcome();
      }),
    );
    await store.seed(queuedRecord());

    await service.run('tg1000001');

    expect(seen).toEqual([undefined, NOW_MS]);
  });

  it('does not run a request that is no longer queued when the worker gets to it', async () => {
    const investigate = jest.fn();
    const { service, store } = setup(investigate);
    await store.seed(queuedRecord());
    store.transition = async () => false;

    expect(await service.run('tg1000001')).toBe(RunResult.SKIPPED);
    expect(investigate).not.toHaveBeenCalled();
  });

  it('keeps going when marking the run clock fails', async () => {
    const { service, store } = setup(
      jest.fn().mockImplementation(async (request: { onSnapshotReady: () => Promise<void> }) => {
        await request.onSnapshotReady();
        return answeredOutcome();
      }),
    );
    await store.seed(queuedRecord());
    const realTransition = store.transition.bind(store);
    store.transition = async (record, from) => {
      if (record.runStartedAtMs !== undefined) throw new Error('redis timeout');
      return realTransition(record, from);
    };

    expect(await service.run('tg1000001')).toBe(RunResult.FINISHED);
  });
});
