import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import IORedis from 'ioredis';

import { type RunLock } from '../../domain/ports/run-lock.port';
import { MONITORING_REDIS_CLIENT } from '../counters/redis-failure-counter.store';

const LOCK_KEY = 'monitoring:runchecks:lock';
const LOCK_TTL_SECONDS = 60;

const RELEASE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

@Injectable()
export class RedisRunLockAdapter implements RunLock {
  constructor(@Inject(MONITORING_REDIS_CLIENT) private readonly redis: IORedis) {}

  async withLock<T>(fn: () => Promise<T>): Promise<T | null> {
    const token = randomUUID();
    const acquired = await this.redis.set(LOCK_KEY, token, 'EX', LOCK_TTL_SECONDS, 'NX');
    if (acquired !== 'OK') return null;

    try {
      return await fn();
    } finally {
      await this.redis.eval(RELEASE_LUA, 1, LOCK_KEY, token).catch(() => undefined);
    }
  }
}
