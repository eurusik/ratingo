import { type ConfigType } from '@nestjs/config';

import { type Queue } from 'bullmq';

import type schedulerConfig from '../../../config/scheduler.config';
import { DEFAULT_INGESTION_JOB_OPTIONS, IngestionJob } from '../../shared/contracts';
import { LINK_PENDING_IMPORTS_INTERVAL_MS } from '../domain/constants/import-pending.constants';

import { LinkPendingImportsScheduler } from './link-pending-imports.scheduler';

type SchedulerConfig = ConfigType<typeof schedulerConfig>;

function makeConfig(overrides: Partial<SchedulerConfig> = {}): SchedulerConfig {
  return { enabled: true, timezone: 'UTC', envPrefix: 'test', jobs: [], ...overrides };
}

describe('LinkPendingImportsScheduler', () => {
  let queue: jest.Mocked<Pick<Queue, 'upsertJobScheduler'>>;

  beforeEach(() => {
    queue = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined) };
  });

  const build = (config: SchedulerConfig) =>
    new LinkPendingImportsScheduler(queue as unknown as Queue, config);

  it('registers one repeatable sweeper under a fixed, env-namespaced id', async () => {
    await build(makeConfig()).onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'test:link-pending-imports',
      { every: LINK_PENDING_IMPORTS_INTERVAL_MS },
      { name: IngestionJob.LINK_PENDING_IMPORTS, data: {}, opts: DEFAULT_INGESTION_JOB_OPTIONS },
    );
  });

  it('registers nothing when the scheduler is disabled', async () => {
    await build(makeConfig({ enabled: false })).onModuleInit();

    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('does not block boot when Redis rejects the registration', async () => {
    queue.upsertJobScheduler.mockRejectedValue(new Error('redis down'));

    await expect(build(makeConfig()).onModuleInit()).resolves.toBeUndefined();
  });
});
