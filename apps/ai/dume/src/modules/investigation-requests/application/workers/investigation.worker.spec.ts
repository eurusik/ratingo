import type IORedis from 'ioredis';

import { INVESTIGATION_JOB_NAME } from '../../investigation-requests.constants';
import type { RunInvestigationService } from '../services/run-investigation.service';

import { InvestigationWorker } from './investigation.worker';

const setup = () => {
  const run = jest.fn().mockResolvedValue('finished');
  const worker = new InvestigationWorker(
    { run } as unknown as RunInvestigationService,
    {} as IORedis,
  );
  return { run, worker };
};

describe('InvestigationWorker', () => {
  it('runs the request named by the job', async () => {
    const { run, worker } = setup();

    expect(
      await worker.process({ name: INVESTIGATION_JOB_NAME, data: { requestId: 'tg1000001' } }),
    ).toBe('finished');
    expect(run).toHaveBeenCalledWith('tg1000001');
  });

  it.each([
    ['another job name', { name: 'other', data: { requestId: 'tg1000001' } }],
    ['no request id', { name: INVESTIGATION_JOB_NAME, data: {} }],
    ['no data', { name: INVESTIGATION_JOB_NAME, data: null }],
  ])('ignores a job with %s', async (_name, job) => {
    const { run, worker } = setup();

    expect(await worker.process(job)).toBe('ignored');
    expect(run).not.toHaveBeenCalled();
  });
});
