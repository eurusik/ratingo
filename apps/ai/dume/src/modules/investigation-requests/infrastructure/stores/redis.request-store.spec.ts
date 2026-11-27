import { RequestState } from '../../domain/constants/request.constants';
import { CreateOutcome, FinishOutcome } from '../../domain/ports/request-store.port';
import { RECORD_KEY_PREFIX, RECORD_TTL_SECONDS } from '../../investigation-requests.constants';
import { answeredOutcome, queuedRecord } from '../../testing/investigation-requests.testing';
import { finishRecord } from '../../application/mappers/outcome-record.mapper';

import {
  CorruptRecordError,
  FINISH_SCRIPT,
  RedisRequestStore,
  TRANSITION_SCRIPT,
} from './redis.request-store';

const KEY = `${RECORD_KEY_PREFIX}tg1000001`;

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
    eval: jest.fn(
      async (script: string, _keys: number, key: string, value: string, ...rest: string[]) => {
        const current = values.get(key);
        const state = current === undefined ? undefined : (JSON.parse(current).state as string);
        if (script === FINISH_SCRIPT) {
          if (state === 'answered') return 0;
          values.set(key, value);
          return 1;
        }
        if (script === TRANSITION_SCRIPT) {
          const allowed = rest.slice(1);
          if (state === undefined || !allowed.includes(state)) return 0;
          values.set(key, value);
          return 1;
        }
        throw new Error('unknown script');
      },
    ),
  };
};

const seed = (redis: ReturnType<typeof fakeRedis>, record: object): void => {
  redis.values.set(KEY, JSON.stringify(record));
};

describe('RedisRequestStore', () => {
  it('creates a record once, with a lifetime, and reports the second create as existing', async () => {
    const redis = fakeRedis();
    const store = new RedisRequestStore(redis as never);

    expect(await store.create(queuedRecord())).toBe(CreateOutcome.CREATED);
    expect(await store.create(queuedRecord({ question: 'other' }))).toBe(CreateOutcome.EXISTS);

    expect(redis.calls[0]).toEqual([KEY, 'EX', RECORD_TTL_SECONDS, 'NX']);
    expect((await store.find('tg1000001'))?.question).toBe('Why does sync-show time out?');
  });

  it('keeps its keys outside the queue namespace', () => {
    expect(RECORD_KEY_PREFIX.startsWith('ai-dume:')).toBe(false);
  });

  it('returns null for an unknown id', async () => {
    expect(await new RedisRequestStore(fakeRedis() as never).find('tg1000009')).toBeNull();
  });

  describe('transition', () => {
    it('moves a request only from the states it is allowed to leave, with the script', async () => {
      const redis = fakeRedis();
      const store = new RedisRequestStore(redis as never);
      seed(redis, queuedRecord());

      expect(
        await store.transition(queuedRecord({ state: RequestState.RUNNING }), [
          RequestState.QUEUED,
        ]),
      ).toBe(true);
      expect(
        await store.transition(queuedRecord({ state: RequestState.RUNNING, runStartedAtMs: 5 }), [
          RequestState.QUEUED,
        ]),
      ).toBe(false);

      expect((await store.find('tg1000001'))?.state).toBe(RequestState.RUNNING);
      expect(redis.eval.mock.calls[0]).toEqual([
        TRANSITION_SCRIPT,
        1,
        KEY,
        expect.any(String),
        String(RECORD_TTL_SECONDS),
        RequestState.QUEUED,
      ]);
    });

    it('does not create a record that is gone', async () => {
      const store = new RedisRequestStore(fakeRedis() as never);

      expect(await store.transition(queuedRecord(), [RequestState.QUEUED])).toBe(false);
    });
  });

  it('finishes a request with the script that never overwrites an answer', async () => {
    const redis = fakeRedis();
    const store = new RedisRequestStore(redis as never);
    seed(redis, queuedRecord({ state: 'running' }));

    expect(await store.finish(queuedRecord({ state: 'failed', reason: 'interrupted' }))).toBe(
      FinishOutcome.WRITTEN,
    );
    seed(redis, queuedRecord({ state: 'answered' }));
    expect(await store.finish(queuedRecord({ state: 'failed', reason: 'interrupted' }))).toBe(
      FinishOutcome.KEPT_ANSWER,
    );

    expect((await store.find('tg1000001'))?.state).toBe('answered');
    expect(redis.eval.mock.calls[0]).toEqual([
      FINISH_SCRIPT,
      1,
      KEY,
      expect.any(String),
      String(RECORD_TTL_SECONDS),
    ]);
  });

  describe('reading a stored request', () => {
    it('accepts a record with a real answer', async () => {
      const redis = fakeRedis();
      seed(redis, finishRecord(queuedRecord(), answeredOutcome(), 'eurusik/ratingo', 5));

      expect((await new RedisRequestStore(redis as never).find('tg1000001'))?.result?.commit).toBe(
        'a'.repeat(40),
      );
    });

    it.each([
      ['text that is not JSON', 'not json'],
      ['a record of another version', JSON.stringify({ version: 2, requestId: 'tg1000001' })],
      ['a record with an unknown state', JSON.stringify({ ...queuedRecord(), state: 'weird' })],
      ['a record without a question', JSON.stringify({ ...queuedRecord(), question: undefined })],
      [
        'an answer without facts',
        JSON.stringify({
          ...queuedRecord({ state: 'answered' }),
          result: { repository: 'a/b', ref: 'main', commit: 'x', turns: 1, costUsd: 0, answer: {} },
        }),
      ],
      [
        'an answer whose citation has no path',
        JSON.stringify({
          ...finishRecord(queuedRecord(), answeredOutcome(), 'a/b', 5),
          result: {
            repository: 'a/b',
            ref: 'main',
            commit: 'x',
            turns: 1,
            costUsd: 0,
            answer: {
              answer: 'x',
              facts: [{ text: 't', citations: [{ startLine: 1, endLine: 2 }], evidence: [] }],
              assumptions: [],
              unknowns: [],
              support: 'supported',
            },
          },
        }),
      ],
    ])('refuses to read %s as a request', async (_name, raw) => {
      const redis = fakeRedis();
      redis.values.set(KEY, raw);

      await expect(new RedisRequestStore(redis as never).find('tg1000001')).rejects.toBeInstanceOf(
        CorruptRecordError,
      );
    });
  });
});
