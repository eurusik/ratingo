import type { Sleeper } from '../domain';
import { describeError } from './describe-error';

export interface RetryAttemptFailure {
  error: unknown;
  attempt: number;
  maxAttempts: number;
  delayMs: number;
}

export interface RetryOptions {
  delaysMs: readonly number[];
  sleeper: Sleeper;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (failure: RetryAttemptFailure) => void;
}

export class RetriesExhaustedError extends Error {
  constructor(
    readonly attempts: number,
    readonly lastError: unknown,
  ) {
    super(`Gave up after ${attempts} attempt(s): ${describeError(lastError)}`);
    this.name = 'RetriesExhaustedError';
  }
}

export async function withRetries<T>(
  operation: () => Promise<T>,
  { delaysMs, sleeper, isRetryable = () => true, onRetry }: RetryOptions,
): Promise<{ result: T; attempts: number }> {
  const maxAttempts = delaysMs.length + 1;

  for (let attempt = 1; ; attempt++) {
    try {
      return { result: await operation(), attempts: attempt };
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryable(error)) {
        throw new RetriesExhaustedError(attempt, error);
      }
      const delayMs = delaysMs[attempt - 1];
      onRetry?.({ error, attempt, maxAttempts, delayMs });
      await sleeper.sleep(delayMs);
    }
  }
}
