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

const setup = (investigate: jest.Mock) => {
  const store = new InMemoryRequestStore();
  const limits = new FakeDayLimits();
  const service = new RunInvestigationService(
    store,
    limits,
    { kind: 'github', repository: 'eurusik/ratingo', apiUrl: 'https://api.github.com' },
    new FixedClock(NOW_MS),
    { investigate } as unknown as InvestigationService,
  );
  return { store, limits, service };
};

describe('RunInvestigationService', () => {
  it('runs the stored question on the stored ref and keeps the answer', async () => {
    const investigate = jest.fn().mockResolvedValue(answeredOutcome());
    const { service, store } = setup(investigate);
    await store.save(queuedRecord({ ref: 'development' }));

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
    await store.save(queuedRecord());

    await service.run('tg1000001');

    expect(seen).toEqual([RequestState.RUNNING]);
  });

  it('records why an unanswered run failed', async () => {
    const investigate = jest.fn().mockResolvedValue(
      answeredOutcome({ status: InvestigationStatus.UNANSWERED, answer: null, stopReason: 'timeout' }),
    );
    const { service, store } = setup(investigate);
    await store.save(queuedRecord());

    await service.run('tg1000001');

    expect(store.records.get('tg1000001')).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.TIMEOUT,
    });
  });

  it('records an exception as an internal error and never throws it into the queue', async () => {
    const { service, store } = setup(jest.fn().mockRejectedValue(new Error('boom')));
    await store.save(queuedRecord());

    expect(await service.run('tg1000001')).toBe(RunResult.FAILED);

    expect(store.records.get('tg1000001')).toMatchObject({
      state: RequestState.FAILED,
      reason: FailureReason.INTERNAL_ERROR,
    });
  });

  it('fails a request without calling the model when the day budget is already spent', async () => {
    const investigate = jest.fn();
    const { service, store, limits } = setup(investigate);
    await store.save(queuedRecord());
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
      await store.save(queuedRecord({ state }));

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
    await store.save(queuedRecord({ state: RequestState.RUNNING }));
    await store.save(queuedRecord({ requestId: 'tg1000002', state: RequestState.ANSWERED }));

    await service.markInterrupted('tg1000001');
    await service.markInterrupted('tg1000002');

    expect(store.records.get('tg1000001')?.reason).toBe(FailureReason.INTERRUPTED);
    expect(store.records.get('tg1000002')?.state).toBe(RequestState.ANSWERED);
  });
});
