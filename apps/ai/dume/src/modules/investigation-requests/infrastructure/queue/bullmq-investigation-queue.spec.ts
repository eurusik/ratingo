import {
  INVESTIGATION_JOB_NAME,
  INVESTIGATION_JOB_OPTIONS,
  QUEUE_CALL_TIMEOUT_MS,
} from '../../investigation-requests.constants';

import { BullmqInvestigationQueue, QueueTimeoutError } from './bullmq-investigation-queue';

const queueWith = (existingState?: string) => {
  const remove = jest.fn();
  const add = jest.fn();
  const queue = new BullmqInvestigationQueue({
    add,
    close: jest.fn(),
    getWaitingCount: jest.fn().mockResolvedValue(2),
    getJob: jest
      .fn()
      .mockResolvedValue(
        existingState === undefined ? undefined : { getState: async () => existingState, remove },
      ),
  });
  return { queue, add, remove };
};

describe('BullmqInvestigationQueue', () => {
  it('uses the request id as the job id, so one request is one job, and never retries', async () => {
    const { queue, add } = queueWith();

    await queue.enqueue({ requestId: 'tg1000001' });

    expect(add).toHaveBeenCalledWith(
      INVESTIGATION_JOB_NAME,
      { requestId: 'tg1000001' },
      { ...INVESTIGATION_JOB_OPTIONS, jobId: 'tg1000001' },
    );
    expect(INVESTIGATION_JOB_OPTIONS.attempts).toBe(1);
  });

  it.each(['completed', 'failed'])(
    'removes an old %s job with the same id first, so a revived request is not swallowed',
    async (state) => {
      const { queue, add, remove } = queueWith(state);

      await queue.enqueue({ requestId: 'tg1000001' });

      expect(remove).toHaveBeenCalledTimes(1);
      expect(add).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['waiting', 'active', 'delayed'])(
    'leaves a %s job alone, because that request is already on its way',
    async (state) => {
      const { queue, remove } = queueWith(state);

      await queue.enqueue({ requestId: 'tg1000001' });

      expect(remove).not.toHaveBeenCalled();
    },
  );

  it('reports the number of waiting jobs, not the running one', async () => {
    expect(await queueWith().queue.waitingCount()).toBe(2);
  });

  it('gives up on a queue that does not answer', async () => {
    jest.useFakeTimers();
    const queue = new BullmqInvestigationQueue({
      add: () => new Promise(() => undefined),
      close: jest.fn(),
      getWaitingCount: () => new Promise(() => undefined),
      getJob: () => new Promise(() => undefined),
    });

    const adding = queue.enqueue({ requestId: 'tg1000001' }).catch((error: unknown) => error);
    const counting = queue.waitingCount().catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(QUEUE_CALL_TIMEOUT_MS);

    expect(await adding).toBeInstanceOf(QueueTimeoutError);
    expect(await counting).toBeInstanceOf(QueueTimeoutError);
    jest.useRealTimers();
  });
});
