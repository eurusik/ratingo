import { randomUUID } from 'crypto';

import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import IORedis from 'ioredis';

import { type CooldownResult, type ICooldownGate } from '../../domain/ports/cooldown-gate.port';

export const COOLDOWN_REDIS_CLIENT = Symbol('COOLDOWN_REDIS_CLIENT');

// Atomically attempts SET NX EX with a unique token value.
// Returns [1, ttl] if acquired, [0, remaining_ttl] if blocked.
// Handles TTL edge cases:
//   -2 (key expired between our SET and TTL) → retry the SET once inside the same script
//       so the token is always stored when we return acquired=true;
//   -1 (key has no expiry, should not happen) → return [0, 1] to unblock quickly.
const LUA_TRY_ACQUIRE = `
local set = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
if set then return {1, tonumber(ARGV[2])} end
local ttl = redis.call('TTL', KEYS[1])
if ttl == -2 then
  local retry = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
  if retry then return {1, tonumber(ARGV[2])} end
  local ttl2 = redis.call('TTL', KEYS[1])
  if ttl2 < 0 then return {0, 0} end
  return {0, ttl2}
end
if ttl == -1 then return {0, 1} end
return {0, ttl}
`;

// Compares stored token before deleting — prevents releasing another acquirer's lock.
const LUA_RELEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

@Injectable()
export class RedisCooldownGateAdapter implements ICooldownGate, OnModuleDestroy {
  private readonly logger = new Logger(RedisCooldownGateAdapter.name);

  constructor(@Inject(COOLDOWN_REDIS_CLIENT) private readonly redis: IORedis) {}

  async onModuleDestroy() {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }

  async tryAcquire(key: string, ttlSeconds: number): Promise<CooldownResult> {
    const token = randomUUID();
    const [acquired, seconds] = (await this.redis.eval(
      LUA_TRY_ACQUIRE,
      1,
      key,
      token,
      String(ttlSeconds),
    )) as [number, number];

    if (acquired === 1) {
      this.logger.debug(`Cooldown acquired: ${key} (TTL: ${ttlSeconds}s)`);
      return { acquired: true, token };
    }

    this.logger.debug(`Cooldown blocked: ${key} (${seconds}s remaining)`);
    return { acquired: false, expiresInSeconds: seconds };
  }

  async release(key: string, token: string): Promise<void> {
    const deleted = (await this.redis.eval(LUA_RELEASE, 1, key, token)) as number;
    if (deleted) {
      this.logger.debug(`Cooldown released: ${key}`);
    } else {
      this.logger.debug(`Cooldown release skipped (token mismatch or already expired): ${key}`);
    }
  }
}
