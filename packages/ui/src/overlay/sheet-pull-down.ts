import { animateSpring } from './spring';

const FLICK_VELOCITY_PX_PER_MS = 0.4;
const DRAGGING_ATTRIBUTE = 'data-handle-dragging';
const SNAP_MARKER_SELECTOR = '[style*="scroll-snap-align"]';

function snapTargets(scroller: HTMLElement): number[] {
  const scrollerTop = scroller.getBoundingClientRect().top;
  const targets: number[] = [];
  for (const node of scroller.querySelectorAll<HTMLElement>(SNAP_MARKER_SELECTOR)) {
    const align = node.style.scrollSnapAlign;
    if (!align || align.startsWith('none')) continue;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const position = align.startsWith('end')
      ? rect.bottom -
        scrollerTop +
        scroller.scrollTop +
        (parseFloat(style.scrollMarginBottom) || 0) -
        scroller.clientHeight
      : rect.top - scrollerTop + scroller.scrollTop - (parseFloat(style.scrollMarginTop) || 0);
    if (Number.isFinite(position)) targets.push(position);
  }
  return targets;
}

function nearestTarget(targets: number[], current: number, velocity: number): number {
  if (velocity > FLICK_VELOCITY_PX_PER_MS) {
    const lower = targets.filter((target) => target < current - 0.5);
    if (lower.length > 0) return Math.max(...lower);
  }
  if (velocity < -FLICK_VELOCITY_PX_PER_MS) {
    const higher = targets.filter((target) => target > current + 0.5);
    if (higher.length > 0) return Math.min(...higher);
  }
  return targets.reduce((best, target) =>
    Math.abs(target - current) < Math.abs(best - current) ? target : best,
  );
}

export interface SheetPullDown {
  move(event: TouchEvent): void;
  end(): void;
  cancel(): void;
  isDragging(): boolean;
}

export function startSheetPullDown(
  scroller: HTMLElement,
  startY: number,
  onDismiss: () => void,
  allowUpward = false,
): SheetPullDown {
  const startScrollTop = scroller.scrollTop;
  let state: 'pending' | 'dragging' | 'released' = 'pending';
  let lastY = startY;
  let lastTime = performance.now();
  let velocity = 0;
  let cancelSpring: (() => void) | null = null;

  return {
    move(event) {
      const touch = event.touches[0];
      if (!touch || state === 'released') return;
      const travel = touch.clientY - startY;
      if (state === 'pending') {
        if (travel === 0) return;
        if (travel < 0 && !allowUpward) {
          state = 'released';
          return;
        }
        state = 'dragging';
        scroller.setAttribute(DRAGGING_ATTRIBUTE, '');
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      velocity = (touch.clientY - lastY) / Math.max(now - lastTime, 1);
      lastY = touch.clientY;
      lastTime = now;
      scroller.scrollTop = Math.min(startScrollTop - travel, scroller.scrollHeight);
    },
    end() {
      if (state !== 'dragging') return;
      state = 'released';
      const targets = snapTargets(scroller);
      if (targets.length === 0) {
        scroller.removeAttribute(DRAGGING_ATTRIBUTE);
        return;
      }
      const target = nearestTarget(targets, scroller.scrollTop, velocity);
      const dismisses = target <= Math.min(...targets);
      cancelSpring = animateSpring(
        scroller.scrollTop,
        target,
        -velocity,
        (value) => {
          scroller.scrollTop = value;
        },
        () => {
          scroller.removeAttribute(DRAGGING_ATTRIBUTE);
          if (dismisses) onDismiss();
        },
      );
    },
    cancel() {
      cancelSpring?.();
      cancelSpring = null;
      state = 'released';
      scroller.removeAttribute(DRAGGING_ATTRIBUTE);
    },
    isDragging: () => state === 'dragging',
  };
}
