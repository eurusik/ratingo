import { AlertKey } from '../../domain/constants/watchdog-rules.constants';

import { RedisWatchdogStateStore } from './redis.watchdog-state.store';

const fakeRedis = () => {
  const values = new Map<string, string>();
  const ttls = new Map<string, unknown>();
  return {
    values,
    ttls,
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string, _mode: string, ttl: number) => {
      values.set(key, value);
      ttls.set(key, ttl);
      return 'OK' as const;
    },
  };
};

describe('RedisWatchdogStateStore', () => {
  it('round-trips active alerts with a ttl and ignores garbage', async () => {
    const redis = fakeRedis();
    const store = new RedisWatchdogStateStore(redis as never);
    await expect(store.loadActive()).resolves.toEqual([]);
    await store.saveActive([AlertKey.HAPPY_DOWN, AlertKey.FAILED_RUNS]);
    await expect(store.loadActive()).resolves.toEqual([AlertKey.HAPPY_DOWN, AlertKey.FAILED_RUNS]);
    expect([...redis.ttls.values()].every((ttl) => typeof ttl === 'number' && ttl > 0)).toBe(true);
    redis.values.set('ai-veronica:watchdog:active', '["bogus","happy_down"]');
    await expect(store.loadActive()).resolves.toEqual([AlertKey.HAPPY_DOWN]);
    redis.values.set('ai-veronica:watchdog:active', 'not json');
    await expect(store.loadActive()).resolves.toEqual([]);
  });

  it('round-trips the Happy failure streak and treats junk as zero', async () => {
    const redis = fakeRedis();
    const store = new RedisWatchdogStateStore(redis as never);
    await expect(store.loadHappyFailures()).resolves.toBe(0);
    await store.saveHappyFailures(3);
    await expect(store.loadHappyFailures()).resolves.toBe(3);
    redis.values.set('ai-veronica:watchdog:happy-failures', 'x');
    await expect(store.loadHappyFailures()).resolves.toBe(0);
  });
});
