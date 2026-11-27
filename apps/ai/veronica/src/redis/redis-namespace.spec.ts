import * as fc from 'fast-check';

import { CHAT_QUEUE, CHAT_QUEUE_PREFIX } from '../modules/chat/chat.constants';
import { TurnRole } from '../modules/chat/domain/entities/conversation-turn';
import { RedisConversationStore } from '../modules/chat/infrastructure/stores/redis.conversation-store';
import { RedisDelegationStore } from '../modules/chat/infrastructure/stores/redis.delegation-store';
import { DIGEST_QUEUE, DIGEST_QUEUE_PREFIX } from '../modules/digest/digest.constants';
import { AlertKey } from '../modules/watchdog/domain/constants/watchdog-rules.constants';
import { RedisWatchdogStateStore } from '../modules/watchdog/infrastructure/stores/redis.watchdog-state.store';
import { WATCHDOG_QUEUE, WATCHDOG_QUEUE_PREFIX } from '../modules/watchdog/watchdog.constants';

import { collidesWithQueue, queueKey, queueNamespace, type QueueIdentity } from './redis-namespace';

const APP_QUEUES: readonly QueueIdentity[] = [
  { prefix: CHAT_QUEUE_PREFIX, name: CHAT_QUEUE },
  { prefix: DIGEST_QUEUE_PREFIX, name: DIGEST_QUEUE },
  { prefix: WATCHDOG_QUEUE_PREFIX, name: WATCHDOG_QUEUE },
];

const recordKeysUsedByStores = async (): Promise<string[]> => {
  const keys: string[] = [];
  const chain = {
    rpush: (key: string) => (keys.push(key), chain),
    ltrim: (key: string) => (keys.push(key), chain),
    expire: (key: string) => (keys.push(key), chain),
    exec: async () => [],
  };
  const redis = {
    get: async (key: string) => (keys.push(key), null),
    set: async (key: string) => (keys.push(key), 'OK'),
    del: async (key: string) => (keys.push(key), 1),
    eval: async (_script: string, numKeys: number, ...args: string[]) => (
      keys.push(...args.slice(0, numKeys)),
      [1, 'tg1']
    ),
    lrange: async (key: string) => (keys.push(key), []),
    multi: () => chain,
  };
  const conversation = new RedisConversationStore(redis as never);
  await conversation.recent('10');
  await conversation.append('10', [{ role: TurnRole.USER, text: 'q' }]);
  const delegation = new RedisDelegationStore(redis as never);
  await delegation.claimInFlight('10', 'tg1');
  await delegation.releaseInFlight('10', 'tg1');
  await delegation.claimDelivery('tg1');
  await delegation.recordPartSent('tg1', 1);
  await delegation.confirmDelivery('tg1');
  await delegation.releaseDelivery('tg1');
  const watchdog = new RedisWatchdogStateStore(redis as never);
  await watchdog.loadActive();
  await watchdog.saveActive([AlertKey.HAPPY_DOWN]);
  await watchdog.loadHappyFailures();
  await watchdog.saveHappyFailures(1);
  return [...new Set(keys)];
};

const word = fc.stringMatching(/^[a-z0-9-]{1,12}$/);
const queueArb = fc.record({ prefix: word, name: word });

describe('redis key namespaces', () => {
  it('keeps every key the Redis stores actually build outside the namespace of all queues', async () => {
    const keys = await recordKeysUsedByStores();
    expect(keys.length).toBeGreaterThanOrEqual(3);
    for (const key of keys) {
      expect(collidesWithQueue(key, APP_QUEUES)).toBe(false);
    }
  });

  it('would have caught the key that collided with the BullMQ active list', () => {
    expect(collidesWithQueue('ai-veronica:watchdog:active', APP_QUEUES)).toBe(true);
    expect(queueKey({ prefix: 'ai-veronica', name: 'watchdog' }, 'active')).toBe(
      'ai-veronica:watchdog:active',
    );
  });

  it('flags any key under a queue namespace and no key outside it', () => {
    fc.assert(
      fc.property(queueArb, word, (queue, suffix) => {
        expect(collidesWithQueue(queueKey(queue, suffix), [queue])).toBe(true);
        expect(collidesWithQueue(`${queue.prefix}-state:${suffix}`, [queue])).toBe(false);
        expect(collidesWithQueue(`${queue.prefix}:${queue.name}`, [queue])).toBe(false);
      }),
    );
  });

  it('builds namespaces that end with the separator so a longer queue name never matches', () => {
    fc.assert(
      fc.property(queueArb, word, (queue, extra) => {
        const longer = { prefix: queue.prefix, name: `${queue.name}${extra}` };
        expect(collidesWithQueue(queueKey(longer, 'x'), [queue])).toBe(false);
        expect(queueNamespace(queue).endsWith(':')).toBe(true);
      }),
    );
  });
});
