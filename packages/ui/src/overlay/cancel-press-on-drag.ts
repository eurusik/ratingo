const TAP_SLOP_PX = 8;

export interface TouchPress {
  target: EventTarget;
  pointerId: number;
  startY: number;
}

export function cancelPressAfterSlop(press: TouchPress | null, clientY: number): TouchPress | null {
  if (!press || Math.abs(clientY - press.startY) < TAP_SLOP_PX) return press;
  press.target.dispatchEvent(
    new PointerEvent('pointercancel', {
      pointerId: press.pointerId,
      pointerType: 'touch',
      bubbles: true,
    }),
  );
  return null;
}
