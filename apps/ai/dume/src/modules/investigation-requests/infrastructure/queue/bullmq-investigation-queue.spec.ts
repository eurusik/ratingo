import {
  INVESTIGATION_JOB_NAME,
  INVESTIGATION_JOB_OPTIONS,
} from '../../investigation-requests.constants';

import { BullmqInvestigationQueue } from './bullmq-investigation-queue';

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
});
