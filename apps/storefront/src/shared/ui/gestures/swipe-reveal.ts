import { animateSpring } from '@ratingo/ui/motion';

const AXIS_LOCK_SLOP_PX = 8;
const FLICK_VELOCITY_PX_PER_MS = 0.3;
const OVERSHOOT_RESISTANCE = 0.25;
const DRAGGING_ATTRIBUTE = 'data-dragging';
const OPEN_ATTRIBUTE = 'data-open';

let closeOpenReveal: (() => void) | null = null;

interface SwipeRevealParts {
  row: HTMLElement;
  content: HTMLElement;
  actions: HTMLElement;
}

type DragState =
  | { kind: 'idle' }
  | { kind: 'pending'; pointerId: number; startX: number; startY: number }
  | {
      kind: 'dragging';
      pointerId: number;
      startX: number;
      startOffset: number;
      lastX: number;
      lastTime: number;
      velocity: number;
    };

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resist(offset: number, revealWidth: number): number {
  if (offset > 0) return offset * OVERSHOOT_RESISTANCE;
  if (offset < -revealWidth) return -revealWidth + (offset + revealWidth) * OVERSHOOT_RESISTANCE;
  return offset;
}

export function attachSwipeReveal({ row, content, actions }: SwipeRevealParts): () => void {
  let offset = 0;
  let drag: DragState = { kind: 'idle' };
  let cancelSpring: (() => void) | null = null;
  let suppressNextClick = false;

  const revealWidth = () => actions.offsetWidth;
  const isOpen = () => offset < 0;

  const render = (value: number) => {
    offset = value;
    content.style.transform = value === 0 ? '' : `translate3d(${value}px, 0, 0)`;
  };

  const onOutsidePointerDown = (event: PointerEvent) => {
    if (event.target instanceof Node && row.contains(event.target)) return;
    settle(0, 0);
  };

  const close = () => settle(0, 0);

  function markOpen(open: boolean) {
    row.toggleAttribute(OPEN_ATTRIBUTE, open);
    if (open) {
      if (closeOpenReveal !== close) closeOpenReveal?.();
      closeOpenReveal = close;
      document.addEventListener('pointerdown', onOutsidePointerDown, true);
      return;
    }
    if (closeOpenReveal === close) closeOpenReveal = null;
    document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  }

  function settle(target: number, velocity: number) {
    cancelSpring?.();
    cancelSpring = null;
    markOpen(target < 0);
    if (prefersReducedMotion()) {
      render(target);
      return;
    }
    cancelSpring = animateSpring(offset, target, velocity, render, () => {
      cancelSpring = null;
    });
  }

  const onPointerDown = (event: PointerEvent) => {
    suppressNextClick = false;
    if (!event.isPrimary || event.button !== 0) return;
    cancelSpring?.();
    cancelSpring = null;
    drag = {
      kind: 'pending',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const startDragging = (event: PointerEvent, startX: number) => {
    drag = {
      kind: 'dragging',
      pointerId: event.pointerId,
      startX,
      startOffset: offset,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
    content.setPointerCapture?.(event.pointerId);
    row.setAttribute(DRAGGING_ATTRIBUTE, '');
  };

  const onPointerMove = (event: PointerEvent) => {
    if (drag.kind === 'idle' || event.pointerId !== drag.pointerId) return;
    if (drag.kind === 'pending') {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_SLOP_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag = { kind: 'idle' };
        return;
      }
      startDragging(event, drag.startX);
      return;
    }
    const elapsed = Math.max(event.timeStamp - drag.lastTime, 1);
    drag.velocity = (event.clientX - drag.lastX) / elapsed;
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
    render(resist(drag.startOffset + event.clientX - drag.startX, revealWidth()));
  };

  const settleIfBetweenRests = () => {
    const width = revealWidth();
    if (cancelSpring || offset === 0 || offset === -width) return;
    settle(offset < -width / 2 ? -width : 0, 0);
  };

  const finishDrag = (event: PointerEvent) => {
    if (drag.kind !== 'dragging' || event.pointerId !== drag.pointerId) {
      drag = { kind: 'idle' };
      settleIfBetweenRests();
      return;
    }
    const { velocity } = drag;
    drag = { kind: 'idle' };
    row.removeAttribute(DRAGGING_ATTRIBUTE);
    suppressNextClick = true;
    const width = revealWidth();
    const opens =
      velocity < -FLICK_VELOCITY_PX_PER_MS ||
      (velocity <= FLICK_VELOCITY_PX_PER_MS && offset < -width / 2);
    settle(opens ? -width : 0, velocity);
  };

  const onContentClick = (event: MouseEvent) => {
    const closesOpenRow = !suppressNextClick && isOpen();
    if (!suppressNextClick && !closesOpenRow) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
    if (closesOpenRow) close();
  };

  const onActionsFocus = () => {
    if (!isOpen()) settle(-revealWidth(), 0);
  };

  const onRowFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return;
    if (isOpen()) close();
  };

  const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen()) close();
  };

  content.addEventListener('pointerdown', onPointerDown);
  content.addEventListener('pointermove', onPointerMove);
  content.addEventListener('pointerup', finishDrag);
  content.addEventListener('pointercancel', finishDrag);
  content.addEventListener('click', onContentClick, true);
  actions.addEventListener('focusin', onActionsFocus);
  row.addEventListener('focusout', onRowFocusOut);
  row.addEventListener('keydown', onEscape);

  return () => {
    cancelSpring?.();
    markOpen(false);
    content.removeEventListener('pointerdown', onPointerDown);
    content.removeEventListener('pointermove', onPointerMove);
    content.removeEventListener('pointerup', finishDrag);
    content.removeEventListener('pointercancel', finishDrag);
    content.removeEventListener('click', onContentClick, true);
    actions.removeEventListener('focusin', onActionsFocus);
    row.removeEventListener('focusout', onRowFocusOut);
    row.removeEventListener('keydown', onEscape);
  };
}
