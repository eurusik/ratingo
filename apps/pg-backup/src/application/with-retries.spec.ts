import { RetriesExhaustedError, withRetries } from './with-retries';

describe('withRetries', () => {
  const sleeper = { sleep: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => sleeper.sleep.mockClear());

  it('returns the result and attempt count once the operation succeeds', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('SlowDown'))
      .mockRejectedValueOnce(new Error('SlowDown'))
      .mockResolvedValue('ok');

    await expect(withRetries(operation, { delaysMs: [10, 20, 30], sleeper })).resolves.toEqual({
      result: 'ok',
      attempts: 3,
    });
  });

  it('sleeps the configured delay before each retry and reports it', async () => {
    const onRetry = jest.fn();
    const operation = jest.fn().mockRejectedValue(new Error('SlowDown'));

    await expect(
      withRetries(operation, { delaysMs: [10, 20], sleeper, onRetry }),
    ).rejects.toThrow();

    expect(sleeper.sleep.mock.calls).toEqual([[10], [20]]);
    expect(
      onRetry.mock.calls.map(([failure]) => [
        failure.attempt,
        failure.maxAttempts,
        failure.delayMs,
      ]),
    ).toEqual([
      [1, 3, 10],
      [2, 3, 20],
    ]);
  });

  it('throws RetriesExhaustedError carrying the attempts and the last error', async () => {
    const lastError = new Error('failure 3');
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('failure 1'))
      .mockRejectedValueOnce(new Error('failure 2'))
      .mockRejectedValueOnce(lastError);

    const error = await withRetries(operation, { delaysMs: [1, 1], sleeper }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(RetriesExhaustedError);
    expect(error).toMatchObject({ attempts: 3, lastError });
  });

  it('stops at the first error that is not retryable', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('AccessDenied'));

    await expect(
      withRetries(operation, { delaysMs: [10, 20], sleeper, isRetryable: () => false }),
    ).rejects.toMatchObject({ attempts: 1 });
    expect(sleeper.sleep).not.toHaveBeenCalled();
  });

  it('makes a single attempt when no delays are configured', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('EPIPE'));

    await expect(withRetries(operation, { delaysMs: [], sleeper })).rejects.toMatchObject({
      attempts: 1,
    });
    expect(sleeper.sleep).not.toHaveBeenCalled();
  });
});
