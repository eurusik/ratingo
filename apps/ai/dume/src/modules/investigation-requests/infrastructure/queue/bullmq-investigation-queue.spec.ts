import {
  INVESTIGATION_JOB_NAME,
  INVESTIGATION_JOB_OPTIONS,
  QUEUE_CALL_TIMEOUT_MS,
} from '../../investigation-requests.constants';

import { BullmqInvestigationQueue, QueueTimeoutError } from './bullmq-investigation-queue';

describe('BullmqInvestigationQueue', () => {
  it('uses the request id as the job id, so one request is one job, and never retries', async () => {
    const add = jest.fn();
    const queue = new BullmqInvestigationQueue({
      add,
      close: jest.fn(),
      getWaitingCount: jest.fn(),
    });

    await queue.enqueue({ requestId: 'tg1000001' });

    expect(add).toHaveBeenCalledWith(
      INVESTIGATION_JOB_NAME,
      { requestId: 'tg1000001' },
      { ...INVESTIGATION_JOB_OPTIONS, jobId: 'tg1000001' },
    );
    expect(INVESTIGATION_JOB_OPTIONS.attempts).toBe(1);
  });

  it('reports the number of waiting jobs, not the running one', async () => {
    const queue = new BullmqInvestigationQueue({
      add: jest.fn(),
      close: jest.fn(),
      getWaitingCount: jest.fn().mockResolvedValue(2),
    });

    expect(await queue.waitingCount()).toBe(2);
  });

  it('gives up on a queue that does not answer', async () => {
    jest.useFakeTimers();
    const queue = new BullmqInvestigationQueue({
      add: () => new Promise(() => undefined),
      close: jest.fn(),
      getWaitingCount: () => new Promise(() => undefined),
    });

    const adding = queue.enqueue({ requestId: 'tg1000001' }).catch((error: unknown) => error);
    const counting = queue.waitingCount().catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(QUEUE_CALL_TIMEOUT_MS);

    expect(await adding).toBeInstanceOf(QueueTimeoutError);
    expect(await counting).toBeInstanceOf(QueueTimeoutError);
    jest.useRealTimers();
  });
});
