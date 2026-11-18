import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type RefObject,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

const LONG_PRESS_MS = 500;
const PRIMARY_BUTTON = 0;
const HOVER_POINTERS = new Set(['mouse', 'pen']);
const MENU_SHORTCUT_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' ']);

export type MenuIntent = 'hover' | 'focus' | 'longPress' | 'shortcut';

interface MenuIntentOptions {
  onIntent: (intent: MenuIntent) => void;
  onActivate: () => void;
  onGestureEnd: () => void;
  pointerGestureRef: RefObject<boolean>;
}

type IntentEventHandlers = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'onPointerDown'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onPointerLeave'
  | 'onPointerEnter'
  | 'onFocus'
  | 'onBlur'
  | 'onKeyDown'
  | 'onContextMenu'
  | 'onClick'
>;

export function useMenuIntent({
  onIntent,
  onActivate,
  onGestureEnd,
  pointerGestureRef,
}: MenuIntentOptions): IntentEventHandlers {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  useEffect(() => cancelLongPress, []);

  const endPointerGesture = () => {
    pointerGestureRef.current = false;
    cancelLongPress();
    onGestureEnd();
  };

  const consumeLongPress = () => {
    const fired = longPressFired.current;
    longPressFired.current = false;
    return fired;
  };

  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== PRIMARY_BUTTON) return;
      pointerGestureRef.current = true;
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
      if (!pointerGestureRef.current) onIntent('focus');
    },
    onBlur: endPointerGesture,
    onKeyDown: (event: KeyboardEvent) => {
      longPressFired.current = false;
      if (!event.altKey || !MENU_SHORTCUT_KEYS.has(event.key)) return;
      event.preventDefault();
      onIntent('shortcut');
    },
    onContextMenu: (event: MouseEvent) => {
      if (pointerGestureRef.current) event.preventDefault();
    },
    onClick: () => {
      if (!consumeLongPress()) onActivate();
      endPointerGesture();
    },
  };
}
