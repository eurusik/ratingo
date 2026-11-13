import { animateSpring } from '../motion/spring';

const FRICTION_PER_60HZ_FRAME = 0.95;
const REFERENCE_FRAME_MS = 1000 / 60;
const MIN_VELOCITY_PX_PER_MS = 0.03;
const MAX_FRAME_MS = 32;
const EDGE_RESISTANCE = 0.5;

export interface ManualScrollHandoff {
  move(clientY: number): void;
  end(): void;
  cancel(): void;
}

function maxScroll(target: HTMLElement): number {
  return Math.max(target.scrollHeight - target.clientHeight, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function startManualScrollHandoff(target: HTMLElement, startY: number): ManualScrollHandoff {
  const content = target.firstElementChild instanceof HTMLElement ? target.firstElementChild : null;
  const startScrollTop = target.scrollTop;
  let lastY = startY;
  let lastTime = performance.now();
  let velocity = 0;
  let frame = 0;
  let cancelSpring: (() => void) | null = null;
  let currentOverscroll = 0;

  const setOverscroll = (overscroll: number) => {
    currentOverscroll = overscroll;
    if (!content) return;
    content.style.transform = overscroll === 0 ? '' : `translateY(${-overscroll}px)`;
  };

  const setPosition = (position: number) => {
    const clamped = clamp(position, 0, maxScroll(target));
    target.scrollTop = clamped;
    setOverscroll(position - clamped);
  };

  const springBack = (overscroll: number, overscrollVelocity: number) => {
    cancelSpring = animateSpring(
      overscroll,
      0,
      overscrollVelocity,
      setOverscroll,
      () => {
        setOverscroll(0);
      },
    );
  };

  const cancel = () => {
    cancelAnimationFrame(frame);
    cancelSpring?.();
    setOverscroll(0);
  };

  return {
    move(clientY) {
      const now = performance.now();
      velocity = (lastY - clientY) / Math.max(now - lastTime, 1);
      lastY = clientY;
      lastTime = now;
      const raw = startScrollTop + (startY - clientY);
      const clamped = clamp(raw, 0, maxScroll(target));
      setPosition(clamped + (raw - clamped) * EDGE_RESISTANCE);
    },
    end() {
      if (currentOverscroll !== 0) {
        springBack(currentOverscroll, 0);
        return;
      }
      let position = target.scrollTop;
      let lastFrame = performance.now();
      const glide = (now: number) => {
        const dt = Math.min(now - lastFrame, MAX_FRAME_MS);
        lastFrame = now;
        if (Math.abs(velocity) < MIN_VELOCITY_PX_PER_MS) return;
        position += velocity * dt;
        const max = maxScroll(target);
        if (position < 0 || position > max) {
          const edge = position < 0 ? 0 : max;
          target.scrollTop = edge;
          springBack(0, velocity);
          return;
        }
        target.scrollTop = position;
        velocity *= FRICTION_PER_60HZ_FRAME ** (dt / REFERENCE_FRAME_MS);
        frame = requestAnimationFrame(glide);
      };
      frame = requestAnimationFrame(glide);
    },
    cancel,
  };
}
