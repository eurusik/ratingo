import { act, renderHook } from '@testing-library/react';
import { useRefreshRetry, useRetryTransition } from './retry';

const refresh = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

describe('useRetryTransition', () => {
  it('runs the retry inside a transition and settles back to idle', () => {
    const retry = jest.fn();
    const { result } = renderHook(() => useRetryTransition(retry));

    act(() => result.current.retry());

    expect(retry).toHaveBeenCalledTimes(1);
    expect(result.current.isRetrying).toBe(false);
  });
});

describe('useRefreshRetry', () => {
  it('re-renders the server data on retry', () => {
    const { result } = renderHook(() => useRefreshRetry());

    act(() => result.current.retry());

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
