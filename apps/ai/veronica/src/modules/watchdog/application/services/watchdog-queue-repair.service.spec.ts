import { RepairOutcome } from '../../domain/ports/watchdog.ports';
import { RedisQueueKeyRepair } from '../../infrastructure/stores/redis.queue-key-repair';

import { WatchdogQueueRepair } from './watchdog-queue-repair.service';

const KEY = 'ai-veronica:watchdog:active';

const fakeRedis = (type: string) => ({
  type: jest.fn().mockResolvedValue(type),
  del: jest.fn().mockResolvedValue(1),
});

describe('queue key repair', () => {
  it.each(['list', 'none'])('leaves a %s key alone', async (type) => {
    const redis = fakeRedis(type);
    const result = await new RedisQueueKeyRepair(redis as never).repairActiveJobsList();
    expect(result.outcome).toBe(RepairOutcome.HEALTHY);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it.each(['string', 'hash', 'set', 'zset'])(
    'deletes only the active list when it is a %s',
    async (type) => {
      const redis = fakeRedis(type);
      const result = await new RedisQueueKeyRepair(redis as never).repairActiveJobsList();
      expect(result).toEqual({ outcome: RepairOutcome.REPAIRED, foundType: type });
      expect(redis.type).toHaveBeenCalledWith(KEY);
      expect(redis.del).toHaveBeenCalledTimes(1);
      expect(redis.del).toHaveBeenCalledWith(KEY);
    },
  );

  it('runs once per process even when called by both the worker and the scheduler', async () => {
    const repair = {
      repairActiveJobsList: jest.fn().mockResolvedValue({ outcome: 'healthy', foundType: 'list' }),
    };
    const service = new WatchdogQueueRepair(repair);
    await Promise.all([service.ensure(), service.ensure()]);
    expect(repair.repairActiveJobsList).toHaveBeenCalledTimes(1);
  });

  it('logs a failure and lets startup continue', async () => {
    const service = new WatchdogQueueRepair({
      repairActiveJobsList: jest.fn().mockRejectedValue(new Error('redis down')),
    });
    await expect(service.ensure()).resolves.toBeUndefined();
  });
});
