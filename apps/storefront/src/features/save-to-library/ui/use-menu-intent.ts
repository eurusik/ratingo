import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

const LONG_PRESS_MS = 500;
const HOVER_POINTERS = new Set(['mouse', 'pen']);
const MENU_SHORTCUT_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' ']);

export type MenuIntent = 'hover' | 'focus' | 'longPress' | 'shortcut';

interface MenuIntentHandlers {
  onIntent: (intent: MenuIntent) => void;
  onActivate: () => void;
}

export function useMenuIntent({ onIntent, onActivate }: MenuIntentHandlers) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPointerGesture = useRef(false);
  const longPressFired = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  useEffect(() => cancelLongPress, []);

  const endPointerGesture = () => {
    isPointerGesture.current = false;
    cancelLongPress();
  };

  return {
    onPointerDown: () => {
      isPointerGesture.current = true;
      longPressFired.current = false;
      cancelLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        longPressFired.current = true;
        onIntent('longPress');
      }, LONG_PRESS_MS);
    },
    onPointerUp: cancelLongPress,
    onPointerCancel: endPointerGesture,
    onPointerLeave: cancelLongPress,
    onPointerEnter: (event: PointerEvent) => {
      if (HOVER_POINTERS.has(event.pointerType)) onIntent('hover');
    },
    onFocus: () => {
      if (!isPointerGesture.current) onIntent('focus');
    },
    onKeyDown: (event: KeyboardEvent) => {
      longPressFired.current = false;
      if (!event.altKey || !MENU_SHORTCUT_KEYS.has(event.key)) return;
      event.preventDefault();
      onIntent('shortcut');
    },
    onContextMenu: (event: MouseEvent) => {
      if (isPointerGesture.current) event.preventDefault();
    },
    onClick: () => {
      isPointerGesture.current = false;
      if (longPressFired.current) longPressFired.current = false;
      else onActivate();
    },
  };
}
