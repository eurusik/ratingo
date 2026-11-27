import {
  CLAIM_DELIVERY_SCRIPT,
  CLAIM_IN_FLIGHT_SCRIPT,
  DELIVERED_KEY_PREFIX,
  INFLIGHT_KEY_PREFIX,
  PARTS_KEY_PREFIX,
  RELEASE_DELIVERY_SCRIPT,
  RELEASE_IN_FLIGHT_SCRIPT,
  RedisDelegationStore,
} from './redis.delegation-store';

const fakeRedis = () => {
  const values = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    values,
    ttls,
    set: jest.fn(async (key: string, value: string, ...flags: (string | number)[]) => {
      values.set(key, value);
      ttls.set(key, Number(flags[1]));
      return 'OK';
    }),
    eval: jest.fn(async (script: string, _keys: number, ...args: string[]) => {
      if (script === CLAIM_IN_FLIGHT_SCRIPT) {
        const [key, requestId] = args as [string, string];
        const held = values.get(key);
        if (held === undefined || held === requestId) {
          values.set(key, requestId);
          return [1, requestId];
        }
        return [0, held];
      }
      if (script === RELEASE_IN_FLIGHT_SCRIPT) {
        const [key, requestId] = args as [string, string];
        return values.get(key) === requestId ? Number(values.delete(key)) : 0;
      }
      if (script === CLAIM_DELIVERY_SCRIPT) {
        const [key, partsKey] = args as [string, string];
        const state = values.get(key);
        if (state === 'sent') return ['sent', 0];
        if (state !== undefined) return ['sending', 0];
        values.set(key, 'sending');
        ttls.set(key, Number(args[2]));
        return ['claimed', Number(values.get(partsKey) ?? 0)];
      }
      if (script === RELEASE_DELIVERY_SCRIPT) {
        const [key] = args as [string];
        return values.get(key) === 'sending' ? Number(values.delete(key)) : 0;
      }
      throw new Error('unknown script');
    }),
  };
};

describe('RedisDelegationStore', () => {
  it('lets one request hold the chat and refuses another, but lets the holder come back', async () => {
    const store = new RedisDelegationStore(fakeRedis() as never);

    expect(await store.claimInFlight('10', 'tg1')).toEqual({ claimed: true });
    expect(await store.claimInFlight('10', 'tg2')).toEqual({ claimed: false, heldBy: 'tg1' });
    expect(await store.claimInFlight('10', 'tg1')).toEqual({ claimed: true });
    expect(await store.claimInFlight('11', 'tg2')).toEqual({ claimed: true });
  });

  it('frees the chat only for the request that holds it', async () => {
    const redis = fakeRedis();
    const store = new RedisDelegationStore(redis as never);
    await store.claimInFlight('10', 'tg1');

    await store.releaseInFlight('10', 'tg2');
    expect(redis.values.has(`${INFLIGHT_KEY_PREFIX}10`)).toBe(true);
    await store.releaseInFlight('10', 'tg1');
    expect(redis.values.has(`${INFLIGHT_KEY_PREFIX}10`)).toBe(false);
  });

  it('claims a delivery once, reports a send in progress and a finished one apart', async () => {
    const store = new RedisDelegationStore(fakeRedis() as never);

    expect(await store.claimDelivery('tg1')).toEqual({ kind: 'claimed', partsSent: 0 });
    expect(await store.claimDelivery('tg1')).toEqual({ kind: 'sending' });
    await store.confirmDelivery('tg1');
    expect(await store.claimDelivery('tg1')).toEqual({ kind: 'sent' });
  });

  it('gives the delivery claim back only while it is still a send in progress', async () => {
    const store = new RedisDelegationStore(fakeRedis() as never);
    await store.claimDelivery('tg1');

    await store.releaseDelivery('tg1');
    expect(await store.claimDelivery('tg1')).toEqual({ kind: 'claimed', partsSent: 0 });
    await store.confirmDelivery('tg1');
    await store.releaseDelivery('tg1');
    expect(await store.claimDelivery('tg1')).toEqual({ kind: 'sent' });
  });

  it('remembers how many messages went out, so a claim after a crash resumes there', async () => {
    const redis = fakeRedis();
    const store = new RedisDelegationStore(redis as never);
    await store.claimDelivery('tg1');
    await store.recordPartSent('tg1', 2);
    redis.values.delete(`${DELIVERED_KEY_PREFIX}tg1`);

    expect(await store.claimDelivery('tg1')).toEqual({ kind: 'claimed', partsSent: 2 });
  });

  it('holds the delivery for two minutes while sending and for days once sent', async () => {
    const redis = fakeRedis();
    const store = new RedisDelegationStore(redis as never);

    await store.claimDelivery('tg1');
    expect(redis.ttls.get(`${DELIVERED_KEY_PREFIX}tg1`)).toBe(120);
    await store.confirmDelivery('tg1');
    expect(redis.ttls.get(`${DELIVERED_KEY_PREFIX}tg1`)).toBe(3 * 24 * 60 * 60);
  });

  it('claims and releases with scripts, so no step can be interleaved with another client', () => {
    for (const script of [
      CLAIM_IN_FLIGHT_SCRIPT,
      RELEASE_IN_FLIGHT_SCRIPT,
      CLAIM_DELIVERY_SCRIPT,
      RELEASE_DELIVERY_SCRIPT,
    ]) {
      expect(script).toContain('redis.call');
    }
    expect(RELEASE_IN_FLIGHT_SCRIPT).toContain("redis.call('get', KEYS[1]) == ARGV[1]");
  });

  it('keeps its keys outside every queue namespace', () => {
    for (const prefix of [INFLIGHT_KEY_PREFIX, DELIVERED_KEY_PREFIX, PARTS_KEY_PREFIX]) {
      expect(prefix.startsWith('ai-veronica:chat:')).toBe(false);
    }
  });
});
