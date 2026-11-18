import { useEffect, useRef } from 'react';

const LONG_PRESS_MS = 500;

export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => cancel, []);

  return {
    isPressing: () => timer.current !== null,
    consumeLongPress: () => {
      const wasLongPress = fired.current;
      fired.current = false;
      return wasLongPress;
    },
    start: () => {
      cancel();
      fired.current = false;
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    cancel,
  };
}
