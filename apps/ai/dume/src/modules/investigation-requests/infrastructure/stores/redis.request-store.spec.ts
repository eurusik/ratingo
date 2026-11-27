import { RECORD_KEY_PREFIX, RECORD_TTL_SECONDS } from '../../investigation-requests.constants';
import { CreateOutcome } from '../../domain/ports/request-store.port';
import { queuedRecord } from '../../testing/investigation-requests.testing';

import { FinishOutcome } from '../../domain/ports/request-store.port';

import { CorruptRecordError, FINISH_SCRIPT, RedisRequestStore } from './redis.request-store';

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
    eval: jest.fn(async (_script: string, _keys: number, key: string, value: string) => {
      const current = values.get(key);
      if (current !== undefined && JSON.parse(current).state === 'answered') return 0;
      values.set(key, value);
      return 1;
    }),
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

  it('finishes a request with the script that never overwrites an answer', async () => {
    const redis = fakeRedis();
    const store = new RedisRequestStore(redis as never);
    await store.save(queuedRecord({ state: 'running' }));

    expect(await store.finish(queuedRecord({ state: 'failed', reason: 'interrupted' }))).toBe(
      FinishOutcome.WRITTEN,
    );
    await store.save(queuedRecord({ state: 'answered' }));
    expect(await store.finish(queuedRecord({ state: 'failed', reason: 'interrupted' }))).toBe(
      FinishOutcome.KEPT_ANSWER,
    );

    expect((await store.find('tg1000001'))?.state).toBe('answered');
    expect(redis.eval.mock.calls[0]).toEqual([
      FINISH_SCRIPT,
      1,
      `${RECORD_KEY_PREFIX}tg1000001`,
      expect.any(String),
      String(RECORD_TTL_SECONDS),
    ]);
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['a record of another version', JSON.stringify({ version: 2, requestId: 'tg1000001' })],
    ['a record with an unknown state', JSON.stringify({ ...queuedRecord(), state: 'weird' })],
    ['a record without a question', JSON.stringify({ ...queuedRecord(), question: undefined })],
  ])('refuses to read %s as a request', async (_name, raw) => {
    const redis = fakeRedis();
    redis.values.set(`${RECORD_KEY_PREFIX}tg1000001`, raw);

    await expect(new RedisRequestStore(redis as never).find('tg1000001')).rejects.toBeInstanceOf(
      CorruptRecordError,
    );
  });
});
