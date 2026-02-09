import { renderHook, act, waitFor } from '@testing-library/react';
import { useMutationGuard } from '../use-mutation-guard';

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

import { toast } from 'sonner';

const mockToastError = toast.error as jest.Mock;

describe('useMutationGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes the action when guard is called', async () => {
    const { result } = renderHook(() => useMutationGuard('Error message'));
    const mockAction = jest.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.guard(mockAction);
    });

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('prevents concurrent execution when guard is called multiple times', async () => {
    const { result } = renderHook(() => useMutationGuard('Error message'));

    let resolveFirstAction: () => void;
    const firstAction = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstAction = resolve;
        }),
    );
    const secondAction = jest.fn().mockResolvedValue(undefined);

    // Start first action
    let firstGuardPromise: Promise<void>;
    await act(async () => {
      firstGuardPromise = result.current.guard(firstAction);
    });

    // Wait a tick to ensure first action started
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Try to execute second action while first is still pending
    await act(async () => {
      await result.current.guard(secondAction);
    });

    // Second action should not have been called
    expect(secondAction).not.toHaveBeenCalled();
    expect(firstAction).toHaveBeenCalledTimes(1);

    // Resolve first action
    await act(async () => {
      resolveFirstAction!();
      await firstGuardPromise!;
    });

    // Now second action should work
    await act(async () => {
      await result.current.guard(secondAction);
    });

    expect(secondAction).toHaveBeenCalledTimes(1);
  });

  it('shows error toast when action throws', async () => {
    const errorMessage = 'Custom error message';
    const { result } = renderHook(() => useMutationGuard(errorMessage));
    const mockAction = jest.fn().mockRejectedValue(new Error('Action failed'));

    await act(async () => {
      await result.current.guard(mockAction);
    });

    expect(mockToastError).toHaveBeenCalledWith(errorMessage);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('resets isMutating to false after successful action', async () => {
    const { result } = renderHook(() => useMutationGuard('Error message'));

    let resolveAction: () => void;
    const mockAction = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );

    // Start action
    let guardPromise: Promise<void>;
    await act(async () => {
      guardPromise = result.current.guard(mockAction);
    });

    // Wait a tick to ensure action started
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should be mutating during action
    expect(result.current.isMutating.current).toBe(true);

    // Resolve action and wait for guard to complete
    await act(async () => {
      resolveAction!();
      await guardPromise!;
    });

    // Should not be mutating after successful completion
    expect(result.current.isMutating.current).toBe(false);
  });

  it('resets isMutating to false after action throws error', async () => {
    const { result } = renderHook(() => useMutationGuard('Error message'));

    let rejectAction: (error: Error) => void;
    const mockAction = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectAction = reject;
        }),
    );

    // Start action
    let guardPromise: Promise<void>;
    await act(async () => {
      guardPromise = result.current.guard(mockAction);
    });

    // Wait a tick to ensure action started
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should be mutating during action
    expect(result.current.isMutating.current).toBe(true);

    // Reject action and wait for guard to complete
    await act(async () => {
      rejectAction!(new Error('Action failed'));
      await guardPromise!;
    });

    // Should not be mutating after error
    expect(result.current.isMutating.current).toBe(false);
  });

  it('sets isMutating.current to true during action execution', async () => {
    const { result } = renderHook(() => useMutationGuard('Error message'));

    let resolveAction: () => void;
    let isMutatingDuringExecution = false;

    const mockAction = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          // Capture the isMutating state during action execution
          isMutatingDuringExecution = result.current.isMutating.current;
          resolveAction = resolve;
        }),
    );

    // Initially not mutating
    expect(result.current.isMutating.current).toBe(false);

    // Start action
    let guardPromise: Promise<void>;
    await act(async () => {
      guardPromise = result.current.guard(mockAction);
    });

    // Wait a tick to ensure action started
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should be mutating during action
    expect(result.current.isMutating.current).toBe(true);
    expect(isMutatingDuringExecution).toBe(true);

    // Resolve action and wait for guard to complete
    await act(async () => {
      resolveAction!();
      await guardPromise!;
    });

    // Should not be mutating after completion
    expect(result.current.isMutating.current).toBe(false);
  });
});
