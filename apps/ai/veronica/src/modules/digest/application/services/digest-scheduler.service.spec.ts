import type { Queue } from 'bullmq';

import type { AgentFolder } from '@ratingo/ai-core';

import { DigestSchedulerService } from './digest-scheduler.service';

const folderWith = (tasks: { name: string; schedule?: string }[]): AgentFolder =>
  ({
    tasks: tasks.map((task) => ({
      name: task.name,
      body: '',
      frontmatter: { schedule: task.schedule, timezone: 'Europe/Kyiv' },
    })),
  }) as unknown as AgentFolder;

const queueWith = (keys: string[]) => ({
  upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
  getJobSchedulers: jest.fn().mockResolvedValue(keys.map((key) => ({ key }))),
  removeJobScheduler: jest.fn().mockResolvedValue(true),
});

describe('DigestSchedulerService', () => {
  it('upserts the daily digest with its cron and timezone', async () => {
    const queue = queueWith(['daily-digest']);
    const folder = folderWith([{ name: 'daily-digest', schedule: '0 9 * * *' }]);
    await new DigestSchedulerService(folder, queue as unknown as Queue).onModuleInit();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'daily-digest',
      { pattern: '0 9 * * *', tz: 'Europe/Kyiv' },
      expect.objectContaining({ name: 'daily-digest' }),
    );
    expect(queue.removeJobScheduler).not.toHaveBeenCalled();
  });

  it('removes schedulers whose task file was deleted', async () => {
    const queue = queueWith(['daily-digest', 'old-task']);
    const folder = folderWith([{ name: 'daily-digest', schedule: '0 9 * * *' }]);
    await new DigestSchedulerService(folder, queue as unknown as Queue).onModuleInit();
    expect(queue.removeJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('old-task');
  });

  it('registers nothing when the task has no schedule', async () => {
    const queue = queueWith([]);
    await new DigestSchedulerService(
      folderWith([{ name: 'daily-digest' }]),
      queue as unknown as Queue,
    ).onModuleInit();
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });
});
