import {
  RECORD_KEY_PREFIX,
  RECORD_TTL_SECONDS,
} from '../../investigation-requests.constants';
import { CreateOutcome } from '../../domain/ports/request-store.port';
import { queuedRecord } from '../../testing/investigation-requests.testing';

import { RedisRequestStore } from './redis.request-store';

const fakeRedis = () => {
  const values = new Map<string, string>();
  const calls: unknown[][] = [];
  return {
    values,
    calls,
    set: jest.fn(async (key: string, value: string, ...flags: (string | number)[]) => {
      calls.push([key, ...flags]);
      if (flags.includes('NX') && values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => values.get(key) ?? null),
  };
};

describe('RedisRequestStore', () => {
  it('creates a record once, with a lifetime, and reports the second create as existing', async () => {
    const redis = fakeRedis();
    const store = new RedisRequestStore(redis as never);

    expect(await store.create(queuedRecord())).toBe(CreateOutcome.CREATED);
    expect(await store.create(queuedRecord({ question: 'other' }))).toBe(CreateOutcome.EXISTS);

    expect(redis.calls[0]).toEqual([
      `${RECORD_KEY_PREFIX}tg1000001`,
      'EX',
      RECORD_TTL_SECONDS,
      'NX',
    ]);
    expect((await store.find('tg1000001'))?.question).toBe('Why does sync-show time out?');
  });

  it('keeps its keys outside the queue namespace', () => {
    expect(RECORD_KEY_PREFIX.startsWith('ai-dume:')).toBe(false);
  });

  it('overwrites on save and refreshes the lifetime', async () => {
    const redis = fakeRedis();
    const store = new RedisRequestStore(redis as never);
    await store.create(queuedRecord());

    await store.save(queuedRecord({ state: 'running' }));

    expect((await store.find('tg1000001'))?.state).toBe('running');
    expect(redis.calls[1]).toEqual([`${RECORD_KEY_PREFIX}tg1000001`, 'EX', RECORD_TTL_SECONDS]);
  });

  it('returns null for an unknown id', async () => {
    expect(await new RedisRequestStore(fakeRedis() as never).find('tg1000009')).toBeNull();
  });
});
