import {
  DELIVERED_KEY_PREFIX,
  INFLIGHT_KEY_PREFIX,
  RedisDelegationStore,
} from './redis.delegation-store';

const fakeRedis = () => {
  const values = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    values,
    ttls,
    set: jest.fn(async (key: string, value: string, ...flags: (string | number)[]) => {
      if (flags.includes('NX') && values.has(key)) return null;
      values.set(key, value);
      ttls.set(key, Number(flags[1]));
      return 'OK';
    }),
    get: jest.fn(async (key: string) => values.get(key) ?? null),
    del: jest.fn(async (key: string) => (values.delete(key) ? 1 : 0)),
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

  it('gives a delivery claim once, until it is released', async () => {
    const store = new RedisDelegationStore(fakeRedis() as never);

    expect(await store.claimDelivery('tg1')).toBe(true);
    expect(await store.claimDelivery('tg1')).toBe(false);
    await store.releaseDelivery('tg1');
    expect(await store.claimDelivery('tg1')).toBe(true);
  });

  it('holds the delivery only briefly while sending, so a crashed send is retried, and for days once sent', async () => {
    const redis = fakeRedis();
    const store = new RedisDelegationStore(redis as never);

    await store.claimDelivery('tg1');
    expect(redis.ttls.get(`${DELIVERED_KEY_PREFIX}tg1`)).toBe(45);
    await store.confirmDelivery('tg1');
    expect(redis.ttls.get(`${DELIVERED_KEY_PREFIX}tg1`)).toBe(3 * 24 * 60 * 60);
    expect(await store.claimDelivery('tg1')).toBe(false);
  });

  it('keeps its keys outside every queue namespace', () => {
    expect(INFLIGHT_KEY_PREFIX.startsWith('ai-veronica:chat:')).toBe(false);
    expect(DELIVERED_KEY_PREFIX.startsWith('ai-veronica:chat:')).toBe(false);
  });
});
