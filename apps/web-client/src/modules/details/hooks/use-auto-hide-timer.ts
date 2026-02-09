import { useCallback, useEffect, useRef } from 'react';

const AUTO_HIDE_MS = 3000;

/**
 * Create an auto-hide timer for a UI element.
 *
 * Calls the provided callback when the timer elapses unless dragging is in progress.
 *
 * @param onHide - Callback invoked when the timer elapses and hiding is allowed
 * @returns An object with:
 *  - `schedule` — starts or resets the auto-hide timer
 *  - `cancel` — clears any pending auto-hide timer
 *  - `isDraggingRef` — mutable ref; set `current` to `true` while dragging to prevent hiding
 */
export function useAutoHideTimer(onHide: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isDraggingRef = useRef(false);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const schedule = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) onHide();
    }, AUTO_HIDE_MS);
  }, [onHide]);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
  }, []);

  return { schedule, cancel, isDraggingRef };
}