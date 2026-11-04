import { withTimeout } from './with-timeout.util';

describe('withTimeout', () => {
  afterEach(() => jest.useRealTimers());

  it('resolves with the work result when it finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('done'), 1000, 'too slow')).resolves.toBe('done');
  });

  it('propagates the work rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'too slow')).rejects.toThrow(
      'boom',
    );
  });

  it('rejects with the timeout message when the work does not settle in time', async () => {
    jest.useFakeTimers();
    const outcome = withTimeout(new Promise(() => undefined), 50, 'too slow').catch(
      (error: unknown) => error,
    );

    await jest.advanceTimersByTimeAsync(50);

    const error = await outcome;
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty('message', 'too slow');
  });

  it('clears its timer once the work settles', async () => {
    jest.useFakeTimers();
    await withTimeout(Promise.resolve(1), 50, 'too slow');
    expect(jest.getTimerCount()).toBe(0);
  });
});
