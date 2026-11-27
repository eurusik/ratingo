import type Redis from 'ioredis';

import type { AgentFolder, ClockPort, RunRepository } from '@ratingo/ai-core';

import { COUNT_KEY_PREFIX, COUNT_TTL_SECONDS } from '../../investigation-requests.constants';
import { utcDayKey, utcDayStartMs } from '../../domain/policies/utc-day.policy';
import type { DayLimitsPort } from '../../domain/ports/day-limits.port';

type RedisCounter = Pick<Redis, 'get' | 'incr' | 'expire'>;

export interface AgentDayLimitsOptions {
  redis: RedisCounter;
  runs: RunRepository;
  folder: AgentFolder;
  clock: ClockPort;
  maxPerDay: number;
}

export class AgentDayLimits implements DayLimitsPort {
  constructor(private readonly options: AgentDayLimitsOptions) {}

  spentTodayUsd(): Promise<number> {
    const nowMs = this.options.clock.nowMs();
    return this.options.runs.spentUsd({
      agent: this.options.folder.manifest.name,
      sinceMs: utcDayStartMs(nowMs),
    });
  }

  dayBudgetUsd(): number {
    return this.options.folder.manifest.budgets.perDayUsd;
  }

  async acceptedToday(): Promise<number> {
    return Number((await this.options.redis.get(this.countKey())) ?? 0);
  }

  async countAccepted(): Promise<void> {
    const key = this.countKey();
    await this.options.redis.incr(key);
    await this.options.redis.expire(key, COUNT_TTL_SECONDS);
  }

  maxPerDay(): number {
    return this.options.maxPerDay;
  }

  private countKey(): string {
    return `${COUNT_KEY_PREFIX}${utcDayKey(this.options.clock.nowMs())}`;
  }
}
