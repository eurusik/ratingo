import { useCallback, useRef } from 'react';

const AUTO_HIDE_MS = 3000;

/**
 * Manages an auto-hide timer for a UI element.
 * Returns stable callbacks and a dragging ref to prevent hiding during interaction.
 */
export function useAutoHideTimer(onHide: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isDraggingRef = useRef(false);

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
