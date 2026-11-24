import type IORedis from 'ioredis';

import { ALERT_KEYS, type AlertKey } from '../../domain/constants/watchdog-rules.constants';
import type { WatchdogStatePort } from '../../domain/ports/watchdog.ports';
import {
  WATCHDOG_ACTIVE_TTL_SECONDS,
  WATCHDOG_HAPPY_FAILURES_TTL_SECONDS,
  WATCHDOG_STATE_KEYS,
} from '../../watchdog.constants';

const isAlertKey = (value: unknown): value is AlertKey =>
  typeof value === 'string' && (ALERT_KEYS as readonly string[]).includes(value);

const parseKeys = (raw: string | null): AlertKey[] => {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAlertKey) : [];
  } catch {
    return [];
  }
};

export class RedisWatchdogStateStore implements WatchdogStatePort {
  constructor(private readonly redis: Pick<IORedis, 'get' | 'set'>) {}

  async loadActive(): Promise<AlertKey[]> {
    return parseKeys(await this.redis.get(WATCHDOG_STATE_KEYS.ACTIVE));
  }

  async saveActive(keys: readonly AlertKey[]): Promise<void> {
    await this.redis.set(
      WATCHDOG_STATE_KEYS.ACTIVE,
      JSON.stringify(keys),
      'EX',
      WATCHDOG_ACTIVE_TTL_SECONDS,
    );
  }

  async loadHappyFailures(): Promise<number> {
    const failures = Number(await this.redis.get(WATCHDOG_STATE_KEYS.HAPPY_FAILURES));
    return Number.isInteger(failures) && failures > 0 ? failures : 0;
  }

  async saveHappyFailures(failures: number): Promise<void> {
    await this.redis.set(
      WATCHDOG_STATE_KEYS.HAPPY_FAILURES,
      String(failures),
      'EX',
      WATCHDOG_HAPPY_FAILURES_TTL_SECONDS,
    );
  }
}
