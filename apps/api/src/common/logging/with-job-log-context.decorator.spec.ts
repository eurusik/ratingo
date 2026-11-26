import { getLogContext } from '@ratingo/node-telemetry';
import type { Job } from 'bullmq';

import { WithJobLogContext } from './with-job-log-context.decorator';

class FakeWorker {
  @WithJobLogContext('ingestion')
  async process(job: Job<unknown>): Promise<unknown> {
    await Promise.resolve();
    return { seen: getLogContext(), name: job.name };
  }
}

describe('WithJobLogContext', () => {
  it('exposes queue, job id and job name to everything the processor calls', async () => {
    const result = await new FakeWorker().process({
      id: 'sync-show_tv_1396',
      name: 'sync-show',
    } as Job);

    expect(result).toEqual({
      name: 'sync-show',
      seen: { queue: 'ingestion', job_id: 'sync-show_tv_1396', job_name: 'sync-show' },
    });
  });

  it('does not leak the context after the job finishes', async () => {
    await new FakeWorker().process({ id: 'a', name: 'b' } as Job);

    expect(getLogContext()).toEqual({});
  });

  it('keeps concurrent jobs apart', async () => {
    const worker = new FakeWorker();

    const [first, second] = (await Promise.all([
      worker.process({ id: '1', name: 'x' } as Job),
      worker.process({ id: '2', name: 'x' } as Job),
    ])) as { seen: { job_id: string } }[];

    expect([first.seen.job_id, second.seen.job_id]).toEqual(['1', '2']);
  });
});
