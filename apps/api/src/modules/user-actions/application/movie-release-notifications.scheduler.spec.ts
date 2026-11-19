import { type ConfigType } from '@nestjs/config';

import { type Queue } from 'bullmq';

import type schedulerConfig from '@/config/scheduler.config';

import { MovieReleaseNotificationsScheduler } from './movie-release-notifications.scheduler';

type SchedulerConfig = ConfigType<typeof schedulerConfig>;

function setup(enabled: boolean) {
  const queue = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined) };
  const config = { enabled, timezone: 'UTC', envPrefix: 'production', jobs: [] } as SchedulerConfig;
  const scheduler = new MovieReleaseNotificationsScheduler(queue as unknown as Queue, config);
  return { scheduler, queue };
}

describe('MovieReleaseNotificationsScheduler', () => {
  it('runs the movie release job every morning at 06:00 UTC', async () => {
    const { scheduler, queue } = setup(true);

    await scheduler.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'production:movie-release-notifications',
      { pattern: '0 6 * * *', tz: 'UTC' },
      { name: 'notify-movie-releases', data: {} },
    );
  });

  it('registers nothing while the scheduler is off', async () => {
    const { scheduler, queue } = setup(false);

    await scheduler.onModuleInit();

    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });
});
