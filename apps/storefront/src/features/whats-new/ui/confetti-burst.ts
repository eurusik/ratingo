'use client';

import { useEffect } from 'react';
import type { Options } from 'canvas-confetti';
import { WHATS_NEW_CONFETTI_COLORS, WHATS_NEW_CONFETTI_DELAY_MS } from '../config/whats-new';

const ABOVE_EVERY_OVERLAY = 2147483000;

const BURST: Options = {
  particleCount: 35,
  spread: 60,
  startVelocity: 32,
  gravity: 0.9,
  ticks: 180,
  scalar: 0.9,
  colors: WHATS_NEW_CONFETTI_COLORS,
  zIndex: ABOVE_EVERY_OVERLAY,
  disableForReducedMotion: true,
};

const FROM_TOP_LEFT: Options = { angle: 300, origin: { x: 0.2, y: -0.05 } };
const FROM_TOP_RIGHT: Options = { angle: 240, origin: { x: 0.8, y: -0.05 } };

const doNothing = () => {};

async function launchConfetti(): Promise<() => void> {
  try {
    const { default: confetti } = await import('canvas-confetti');
    void confetti({ ...BURST, ...FROM_TOP_LEFT });
    void confetti({ ...BURST, ...FROM_TOP_RIGHT });
    return () => confetti.reset();
  } catch {
    return doNothing;
  }
}

export function useConfettiBurst(isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return;

    let isOver = false;
    let stopConfetti = doNothing;
    const keepStopper = (stop: () => void) => {
      if (isOver) stop();
      else stopConfetti = stop;
    };
    const timer = setTimeout(
      () => void launchConfetti().then(keepStopper),
      WHATS_NEW_CONFETTI_DELAY_MS,
    );

    return () => {
      isOver = true;
      clearTimeout(timer);
      stopConfetti();
    };
  }, [isActive]);
}
