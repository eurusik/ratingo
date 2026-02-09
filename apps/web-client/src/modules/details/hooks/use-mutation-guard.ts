import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Provides a concurrency guard for async actions and shows an error toast on failure.
 *
 * @param errorMessage - Message displayed in a toast when the wrapped action throws
 * @returns An object with `guard` and `isMutating`:
 *  - `guard`: executes the provided async action only if no mutation is in progress
 *  - `isMutating`: a ref whose `current` is `true` while a guarded action is running and `false` otherwise
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