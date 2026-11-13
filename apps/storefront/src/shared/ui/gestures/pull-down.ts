import { animateSpring } from '@ratingo/ui/motion';

const START_SLOP_PX = 6;
const PULL_RESISTANCE = 0.5;
const ARMED_ATTRIBUTE = 'data-armed';

const PULL_TO_REFRESH_THRESHOLD_PX = 72;
const MAX_PULL_PX = PULL_TO_REFRESH_THRESHOLD_PX * 1.75;

interface PullDownOptions {
  root: HTMLElement;
  content: HTMLElement;
  indicator: HTMLElement;
  onRelease: () => Promise<void>;
}

type PullState =
  | { kind: 'idle' }
  | { kind: 'pending'; startX: number; startY: number }
  | { kind: 'pulling'; startY: number; lastY: number; lastTime: number; velocity: number }
  | { kind: 'refreshing' };

function resist(travel: number): number {
  return Math.min(Math.max(travel, 0) * PULL_RESISTANCE, MAX_PULL_PX);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function attachPullDown({
  root,
  content,
  indicator,
  onRelease,
}: PullDownOptions): () => void {
  let state: PullState = { kind: 'idle' };
  let pull = 0;
  let cancelSpring: (() => void) | null = null;
  let isDetached = false;

  const render = (value: number) => {
    pull = value;
    content.style.transform = value === 0 ? '' : `translate3d(0, ${value}px, 0)`;
    indicator.style.transform = `translate3d(0, ${value}px, 0)`;
    indicator.style.opacity = String(Math.min(value / PULL_TO_REFRESH_THRESHOLD_PX, 1));
    root.toggleAttribute(ARMED_ATTRIBUTE, value >= PULL_TO_REFRESH_THRESHOLD_PX);
  };

  const springTo = (target: number, velocity: number, onDone?: () => void) => {
    cancelSpring?.();
    if (prefersReducedMotion()) {
      render(target);
      onDone?.();
      return;
    }
    cancelSpring = animateSpring(pull, target, velocity, render, () => {
      cancelSpring = null;
      onDone?.();
    });
  };

  const refresh = async (velocity: number) => {
    state = { kind: 'refreshing' };
    springTo(PULL_TO_REFRESH_THRESHOLD_PX, velocity);
    try {
      await onRelease();
    } catch (error) {
      window.reportError(error);
    } finally {
      if (!isDetached) springTo(0, 0, () => (state = { kind: 'idle' }));
    }
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (state.kind === 'refreshing' || event.touches.length > 1 || !touch) return;
    if (window.scrollY > 0) return;
    cancelSpring?.();
    cancelSpring = null;
    state = {
      kind: 'pending',
      startX: touch.clientX,
      startY: touch.clientY - pull / PULL_RESISTANCE,
    };
  };

  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch || (state.kind !== 'pending' && state.kind !== 'pulling')) return;
    if (state.kind === 'pending') {
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < START_SLOP_PX) return;
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
        state = { kind: 'idle' };
        return;
      }
      state = {
        kind: 'pulling',
        startY: state.startY,
        lastY: touch.clientY,
        lastTime: event.timeStamp,
        velocity: 0,
      };
    }
    if (event.cancelable) event.preventDefault();
    const elapsed = Math.max(event.timeStamp - state.lastTime, 1);
    state.velocity = ((touch.clientY - state.lastY) * PULL_RESISTANCE) / elapsed;
    state.lastY = touch.clientY;
    state.lastTime = event.timeStamp;
    render(resist(touch.clientY - state.startY));
  };

  const onTouchEnd = () => {
    if (state.kind === 'pending') state = { kind: 'idle' };
    if (state.kind !== 'pulling') return;
    const { velocity } = state;
    if (pull >= PULL_TO_REFRESH_THRESHOLD_PX) {
      void refresh(velocity);
      return;
    }
    state = { kind: 'idle' };
    springTo(0, velocity);
  };

  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchmove', onTouchMove, { passive: false });
  root.addEventListener('touchend', onTouchEnd, { passive: true });
  root.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    isDetached = true;
    cancelSpring?.();
    render(0);
    root.removeEventListener('touchstart', onTouchStart);
    root.removeEventListener('touchmove', onTouchMove);
    root.removeEventListener('touchend', onTouchEnd);
    root.removeEventListener('touchcancel', onTouchEnd);
  };
}
