import type Redis from 'ioredis';

import {
  DUME_DELIVERED_TTL_SECONDS,
  DUME_INFLIGHT_TTL_SECONDS,
  DUME_SENDING_TTL_SECONDS,
} from '../../domain/constants/dume.constants';
import type { DelegationStorePort, InFlightClaim } from '../../domain/ports/delegation-store.port';

type RedisCommands = Pick<Redis, 'set' | 'get' | 'del'>;

const SENDING = 'sending';
const SENT = 'sent';

export const INFLIGHT_KEY_PREFIX = 'ai-veronica:dume-inflight:';
export const DELIVERED_KEY_PREFIX = 'ai-veronica:dume-delivered:';

export class RedisDelegationStore implements DelegationStorePort {
  constructor(private readonly redis: RedisCommands) {}

  async claimInFlight(chatId: string, requestId: string): Promise<InFlightClaim> {
    const key = `${INFLIGHT_KEY_PREFIX}${chatId}`;
    const stored = await this.redis.set(key, requestId, 'EX', DUME_INFLIGHT_TTL_SECONDS, 'NX');
    if (stored === 'OK') return { claimed: true };
    const heldBy = await this.redis.get(key);
    return heldBy === requestId || heldBy === null ? { claimed: true } : { claimed: false, heldBy };
  }

  async releaseInFlight(chatId: string, requestId: string): Promise<void> {
    const key = `${INFLIGHT_KEY_PREFIX}${chatId}`;
    if ((await this.redis.get(key)) === requestId) await this.redis.del(key);
  }

  async claimDelivery(requestId: string): Promise<boolean> {
    const stored = await this.redis.set(
      `${DELIVERED_KEY_PREFIX}${requestId}`,
      SENDING,
      'EX',
      DUME_SENDING_TTL_SECONDS,
      'NX',
    );
    return stored === 'OK';
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
    await this.redis.del(`${DELIVERED_KEY_PREFIX}${requestId}`);
  }
}
