import { WatchdogSchedulerService } from './watchdog-scheduler.service';

describe('WatchdogSchedulerService', () => {
  it('upserts one scheduler that fires every five minutes under a stable id', async () => {
    const upsertJobScheduler = jest.fn().mockResolvedValue(undefined);
    const service = new WatchdogSchedulerService(
      { upsertJobScheduler } as never,
      { ensure: async () => undefined } as never,
    );
    await service.onModuleInit();
    await service.onModuleInit();
    const [id, repeat, template] = upsertJobScheduler.mock.calls[0];
    expect(id).toBe('watchdog-tick');
    expect(repeat).toEqual({ every: 5 * 60 * 1000 });
    expect(template.name).toBe('watchdog-tick');
    expect(upsertJobScheduler.mock.calls[1][0]).toBe(id);
  });
});
