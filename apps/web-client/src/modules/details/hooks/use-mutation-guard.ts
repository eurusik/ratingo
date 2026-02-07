import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Wraps an async action with a ref-based concurrency guard and error toast.
 * Prevents double-clicks and centralizes the try/catch/finally pattern.
 */
export function useMutationGuard(errorMessage: string) {
  const mutatingRef = useRef(false);

  const guard = useCallback(
    async (action: () => Promise<void>) => {
      if (mutatingRef.current) return;
      mutatingRef.current = true;
      try {
        await action();
      } catch {
        toast.error(errorMessage);
      } finally {
        mutatingRef.current = false;
      }
    },
    [errorMessage],
  );

  return { guard, isMutating: mutatingRef };
}
