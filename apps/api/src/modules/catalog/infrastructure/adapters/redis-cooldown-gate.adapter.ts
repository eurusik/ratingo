import { Inject, Injectable, Logger } from '@nestjs/common';

import IORedis from 'ioredis';

import { type CooldownResult, type ICooldownGate } from '../../domain/ports/cooldown-gate.port';

export const COOLDOWN_REDIS_CLIENT = Symbol('COOLDOWN_REDIS_CLIENT');

// Atomically attempts SET NX EX; returns [1, ttl] if acquired, [0, remaining_ttl] if blocked.
// Handles TTL edge cases: -2 (expired between SET and TTL) → treats as acquired (retry safe);
// -1 (no expiry, should not happen) → returns 1 second to unblock quickly.
const LUA_TRY_ACQUIRE = `
local set = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
if set then return {1, tonumber(ARGV[2])} end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then return {1, tonumber(ARGV[2])} end
return {0, ttl}
`;

@Injectable()
export class RedisCooldownGateAdapter implements ICooldownGate {
  private readonly logger = new Logger(RedisCooldownGateAdapter.name);

  constructor(@Inject(COOLDOWN_REDIS_CLIENT) private readonly redis: IORedis) {}

  async tryAcquire(key: string, ttlSeconds: number): Promise<CooldownResult> {
    const [acquired, seconds] = (await this.redis.eval(
      LUA_TRY_ACQUIRE,
      1,
      key,
      '1',
      String(ttlSeconds),
    )) as [number, number];

    if (acquired === 1) {
      this.logger.debug(`Cooldown acquired: ${key} (TTL: ${ttlSeconds}s)`);
      return { acquired: true };
    }

    this.logger.debug(`Cooldown blocked: ${key} (${seconds}s remaining)`);
    return { acquired: false, expiresInSeconds: seconds };
  }

  async release(key: string): Promise<void> {
    await this.redis.del(key);
    this.logger.debug(`Cooldown released: ${key}`);
  }
}
