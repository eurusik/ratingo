import { FixedClock, type AgentFolder, type RunRepository } from '@ratingo/ai-core';

import { COUNT_KEY_PREFIX, COUNT_TTL_SECONDS } from '../../investigation-requests.constants';
import { NOW_MS } from '../../testing/investigation-requests.testing';

import { AgentDayLimits } from './agent-day-limits.adapter';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const countKey = `${COUNT_KEY_PREFIX}day${Math.floor(NOW_MS / MS_PER_DAY)}`;

const setup = () => {
  const counts = new Map<string, number>();
  const expire = jest.fn(async () => 1);
  const redis = {
    get: async (key: string) => (counts.has(key) ? String(counts.get(key)) : null),
    incr: async (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1).get(key) ?? 0,
    expire,
  };
  const spentUsd = jest.fn().mockResolvedValue(0.42);
  const folder = {
    manifest: { name: 'dume', budgets: { perRunUsd: 0.3, perDayUsd: 1.5 } },
  } as unknown as AgentFolder;
  const limits = new AgentDayLimits({
    redis: redis as never,
    runs: { spentUsd } as unknown as RunRepository,
    folder,
    clock: new FixedClock(NOW_MS),
    maxPerDay: 10,
  });
  return { limits, counts, expire, spentUsd };
};

describe('AgentDayLimits', () => {
  it('reads the spend of this agent since the start of the UTC day', async () => {
    const { limits, spentUsd } = setup();

    expect(await limits.spentTodayUsd()).toBe(0.42);
    expect(spentUsd).toHaveBeenCalledWith({
      agent: 'dume',
      sinceMs: NOW_MS - (NOW_MS % MS_PER_DAY),
    });
  });

  it('takes the day budget from the manifest and the cap from the config', () => {
    const { limits } = setup();

    expect(limits.dayBudgetUsd()).toBe(1.5);
    expect(limits.maxPerDay()).toBe(10);
  });

  it('counts accepted requests per UTC day with a lifetime', async () => {
    const { limits, counts, expire } = setup();

    expect(await limits.acceptedToday()).toBe(0);
    await limits.countAccepted();
    await limits.countAccepted();

    expect(await limits.acceptedToday()).toBe(2);
    expect([...counts.keys()]).toEqual([countKey]);
    expect(expire).toHaveBeenCalledWith(countKey, COUNT_TTL_SECONDS);
  });
});
