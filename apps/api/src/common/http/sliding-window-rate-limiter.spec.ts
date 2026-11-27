import { SlidingWindowRateLimiter } from './sliding-window-rate-limiter';

describe('SlidingWindowRateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-27T10:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function startedWithin(limiter: SlidingWindowRateLimiter, calls: number, ms: number) {
    let started = 0;
    for (let i = 0; i < calls; i++) void limiter.acquire().then(() => started++);
    await jest.advanceTimersByTimeAsync(ms);
    return started;
  }

  it('lets the first requests of a window through at once', async () => {
    const limiter = new SlidingWindowRateLimiter(3, 10_000);

    await expect(startedWithin(limiter, 3, 0)).resolves.toBe(3);
  });

  it('holds requests over the limit until the window slides', async () => {
    const limiter = new SlidingWindowRateLimiter(3, 10_000);
    let started = 0;
    for (let i = 0; i < 5; i++) void limiter.acquire().then(() => started++);

    await jest.advanceTimersByTimeAsync(9_999);
    expect(started).toBe(3);

    await jest.advanceTimersByTimeAsync(1);
    expect(started).toBe(5);
  });

  it('never starts more than the limit in any window', async () => {
    const limiter = new SlidingWindowRateLimiter(2, 1_000);
    const starts: number[] = [];
    for (let i = 0; i < 7; i++) void limiter.acquire().then(() => starts.push(Date.now()));

    await jest.advanceTimersByTimeAsync(5_000);

    expect(starts).toHaveLength(7);
    for (const start of starts) {
      const inWindow = starts.filter((other) => other > start - 1_000 && other <= start);
      expect(inWindow.length).toBeLessThanOrEqual(2);
    }
  });
});
