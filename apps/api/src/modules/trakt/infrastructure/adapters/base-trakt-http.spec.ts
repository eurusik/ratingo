import { RateLimiter } from './base-trakt-http';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  const queueOf = (l: RateLimiter) => (l as unknown as { queue: unknown[] }).queue;
  const tokensOf = (l: RateLimiter) => (l as unknown as { tokens: number }).tokens;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    limiter?.destroy();
    jest.useRealTimers();
  });

  it('removes a timed-out waiter from the queue', async () => {
    // maxTokens=1, refill every 10s, queue size 5, acquire timeout 1s
    limiter = new RateLimiter(1, 10_000, 5, 1_000);

    const pending = limiter.acquire();
    const outcome = pending.then(
      () => 'resolved',
      (err: Error) => err.message,
    );
    expect(queueOf(limiter)).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(1_000);

    await expect(outcome).resolves.toBe('Rate limiter timeout after 1000ms');
    expect(queueOf(limiter)).toHaveLength(0);
  });

  it('does not spend a refilled token on a stale (timed-out) waiter', async () => {
    limiter = new RateLimiter(1, 5_000, 5, 1_000);

    const stale = limiter.acquire().catch((err: Error) => err);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(await stale).toBeInstanceOf(Error);

    // Token refills at 5s; nobody is waiting, so it must stay in the bucket.
    await jest.advanceTimersByTimeAsync(4_000);
    expect(queueOf(limiter)).toHaveLength(0);
    expect(tokensOf(limiter)).toBe(1);

    // A fresh acquire takes the fast path.
    await expect(limiter.acquire()).resolves.toBeUndefined();
    expect(tokensOf(limiter)).toBe(0);
  });

  it('frees queue slots after timeouts so new requests are not rejected as queue-full', async () => {
    limiter = new RateLimiter(1, 60_000, 2, 1_000);

    const first = limiter.acquire().catch((err: Error) => err);
    const second = limiter.acquire().catch((err: Error) => err);
    await expect(limiter.acquire()).rejects.toThrow(/queue full/i);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(await first).toBeInstanceOf(Error);
    expect(await second).toBeInstanceOf(Error);
    expect(queueOf(limiter)).toHaveLength(0);

    const third = limiter.acquire().catch((err: Error) => err);
    expect(queueOf(limiter)).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(await third).toBeInstanceOf(Error);
  });

  it('only removes the timed-out waiter and keeps later ones queued', async () => {
    limiter = new RateLimiter(1, 10_000, 5, 1_000);

    const early = limiter.acquire().catch((err: Error) => err);
    await jest.advanceTimersByTimeAsync(600);
    const late = limiter.acquire();
    expect(queueOf(limiter)).toHaveLength(2);

    await jest.advanceTimersByTimeAsync(400); // early times out at 1000ms
    expect(await early).toBeInstanceOf(Error);
    expect(queueOf(limiter)).toHaveLength(1);

    // The refill at 10s serves the remaining waiter ... but late's own timeout (1.6s) wins first.
    const lateOutcome = late.then(
      () => 'resolved',
      () => 'timeout',
    );
    await jest.advanceTimersByTimeAsync(700);
    await expect(lateOutcome).resolves.toBe('timeout');
    expect(queueOf(limiter)).toHaveLength(0);
  });

  it('serves a queued waiter when a token is refilled before the timeout', async () => {
    limiter = new RateLimiter(1, 500, 5, 5_000);

    const p = limiter.acquire();
    await jest.advanceTimersByTimeAsync(500);

    await expect(p).resolves.toBeUndefined();
    expect(queueOf(limiter)).toHaveLength(0);
  });
});
