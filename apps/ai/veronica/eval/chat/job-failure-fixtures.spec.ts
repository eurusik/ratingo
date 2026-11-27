import { FixedClock, RowList } from '@ratingo/ai-core';

import { JobFailuresExecutor } from '@ratingo/ai-ops-tools';

import { EVAL_NOW_MS } from './eval-clock';
import { jobFailures } from './job-failure-fixtures';

const emptyExecutor = () =>
  new JobFailuresExecutor({ since: async () => [] }, new FixedClock(EVAL_NOW_MS));

describe('jobFailures fixture helper', () => {
  it('returns for an empty list exactly what the executor returns', async () => {
    const real = (await emptyExecutor().run({})) as RowList;

    expect(jobFailures([])).toEqual(real.withAllRows());
  });

  it.each([
    [{ job: 'trending' }, { job: 'trending', window: '24h' }],
    [{ queue: 'ingestion' }, { queue: 'ingestion', window: '24h' }],
  ])('matches the executor for an empty list filtered by %j', async (filter, extra) => {
    const real = (await emptyExecutor().run(filter)) as RowList;

    expect(jobFailures([], extra)).toEqual(real.withAllRows());
  });

  it('adds no note when the fixture lists failures', () => {
    expect(jobFailures([{ job: 'sync-show' }])).not.toHaveProperty('note');
  });
});
