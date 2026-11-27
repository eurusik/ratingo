import type Redis from 'ioredis';

import {
  DUME_DELIVERED_TTL_SECONDS,
  DUME_INFLIGHT_TTL_SECONDS,
  DUME_SENDING_TTL_SECONDS,
} from '../../domain/constants/dume.constants';
import {
  DeliveryClaimKind,
  type DelegationStorePort,
  type DeliveryClaim,
  type InFlightClaim,
} from '../../domain/ports/delegation-store.port';

type RedisCommands = Pick<Redis, 'set' | 'eval'>;

export const INFLIGHT_KEY_PREFIX = 'ai-veronica:dume-inflight:';
export const DELIVERED_KEY_PREFIX = 'ai-veronica:dume-delivered:';
export const PARTS_KEY_PREFIX = 'ai-veronica:dume-parts:';

const SENDING = 'sending';
const SENT = 'sent';

export const CLAIM_IN_FLIGHT_SCRIPT = `
if redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2], 'NX') then
  return {1, ARGV[1]}
end
local held = redis.call('get', KEYS[1])
if held == ARGV[1] then
  redis.call('expire', KEYS[1], ARGV[2])
  return {1, held}
end
if not held then
  redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
  return {1, ARGV[1]}
end
return {0, held}
`;

export const RELEASE_IN_FLIGHT_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export const CLAIM_DELIVERY_SCRIPT = `
local state = redis.call('get', KEYS[1])
if state == '${SENT}' then
  return {'${DeliveryClaimKind.SENT}', 0}
end
if state then
  return {'${DeliveryClaimKind.SENDING}', 0}
end
redis.call('set', KEYS[1], '${SENDING}', 'EX', ARGV[1])
return {'${DeliveryClaimKind.CLAIMED}', tonumber(redis.call('get', KEYS[2]) or '0')}
`;

export const RELEASE_DELIVERY_SCRIPT = `
if redis.call('get', KEYS[1]) == '${SENDING}' then
  return redis.call('del', KEYS[1])
end
return 0
`;

export class RedisDelegationStore implements DelegationStorePort {
  constructor(private readonly redis: RedisCommands) {}

  async claimInFlight(chatId: string, requestId: string): Promise<InFlightClaim> {
    const [claimed, holder] = (await this.redis.eval(
      CLAIM_IN_FLIGHT_SCRIPT,
      1,
      `${INFLIGHT_KEY_PREFIX}${chatId}`,
      requestId,
      String(DUME_INFLIGHT_TTL_SECONDS),
    )) as [number, string];
    return claimed === 1 ? { claimed: true } : { claimed: false, heldBy: holder };
  }

  async releaseInFlight(chatId: string, requestId: string): Promise<void> {
    await this.redis.eval(
      RELEASE_IN_FLIGHT_SCRIPT,
      1,
      `${INFLIGHT_KEY_PREFIX}${chatId}`,
      requestId,
    );
  }

  async claimDelivery(requestId: string): Promise<DeliveryClaim> {
    const [kind, partsSent] = (await this.redis.eval(
      CLAIM_DELIVERY_SCRIPT,
      2,
      `${DELIVERED_KEY_PREFIX}${requestId}`,
      `${PARTS_KEY_PREFIX}${requestId}`,
      String(DUME_SENDING_TTL_SECONDS),
    )) as [DeliveryClaim['kind'], number];
    return kind === DeliveryClaimKind.CLAIMED ? { kind, partsSent: Number(partsSent) } : { kind };
  }

  async recordPartSent(requestId: string, partsSent: number): Promise<void> {
    await this.redis.set(
      `${PARTS_KEY_PREFIX}${requestId}`,
      String(partsSent),
      'EX',
      DUME_DELIVERED_TTL_SECONDS,
    );
    await this.redis.set(
      `${DELIVERED_KEY_PREFIX}${requestId}`,
      SENDING,
      'EX',
      DUME_SENDING_TTL_SECONDS,
    );
  }

  async confirmDelivery(requestId: string): Promise<void> {
    await this.redis.set(
      `${DELIVERED_KEY_PREFIX}${requestId}`,
      SENT,
      'EX',
      DUME_DELIVERED_TTL_SECONDS,
    );
  }

  async releaseDelivery(requestId: string): Promise<void> {
    await this.redis.eval(RELEASE_DELIVERY_SCRIPT, 1, `${DELIVERED_KEY_PREFIX}${requestId}`);
  }
}
