import type { WatchdogService } from '../services/watchdog.service';

import { WatchdogWorker } from './watchdog.worker';

const workerWith = (tick: jest.Mock) =>
  new WatchdogWorker(
    { tick } as unknown as WatchdogService,
    { ensure: async () => undefined } as never,
    {} as never,
    {} as never,
  );

describe('WatchdogWorker', () => {
  it('runs a tick for a tick job', async () => {
    const tick = jest.fn().mockResolvedValue('done');
    await expect(workerWith(tick).process({ name: 'watchdog-tick' })).resolves.toBe('done');
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown jobs', async () => {
    const tick = jest.fn();
    await expect(workerWith(tick).process({ name: 'other' })).resolves.toBe('ignored');
    expect(tick).not.toHaveBeenCalled();
  });
});
