import * as fc from 'fast-check';

import { CONVERSATION_KEY_PREFIX } from '../modules/chat/chat.constants';
import { CHAT_QUEUE, CHAT_QUEUE_PREFIX } from '../modules/chat/chat.constants';
import { DIGEST_QUEUE, DIGEST_QUEUE_PREFIX } from '../modules/digest/digest.constants';
import {
  WATCHDOG_QUEUE,
  WATCHDOG_QUEUE_PREFIX,
  WATCHDOG_STATE_KEYS,
} from '../modules/watchdog/watchdog.constants';

import { collidesWithQueue, queueKey, queueNamespace, type QueueIdentity } from './redis-namespace';

const APP_QUEUES: readonly QueueIdentity[] = [
  { prefix: CHAT_QUEUE_PREFIX, name: CHAT_QUEUE },
  { prefix: DIGEST_QUEUE_PREFIX, name: DIGEST_QUEUE },
  { prefix: WATCHDOG_QUEUE_PREFIX, name: WATCHDOG_QUEUE },
];

const APP_KEYS: readonly string[] = [
  ...Object.values(WATCHDOG_STATE_KEYS),
  `${CONVERSATION_KEY_PREFIX}10`,
];

const word = fc.stringMatching(/^[a-z0-9-]{1,12}$/);
const queueArb = fc.record({ prefix: word, name: word });

describe('redis key namespaces', () => {
  it('keeps every key the app builds outside the namespace of all its queues', () => {
    for (const key of APP_KEYS) {
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
