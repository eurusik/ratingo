'use client';

import { useEffect } from 'react';

const USER_ACTIVITY_EVENTS = ['scroll', 'wheel', 'pointerdown', 'keydown'] as const;
const LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, passive: true };

export function useOnCalmMoment(isWaiting: boolean, calmMs: number, onCalm: () => void): void {
  useEffect(() => {
    if (!isWaiting) return;

    let timer = setTimeout(onCalm, calmMs);
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(onCalm, calmMs);
    };
    USER_ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, restart, LISTENER_OPTIONS),
    );

    return () => {
      clearTimeout(timer);
      USER_ACTIVITY_EVENTS.forEach((type) =>
        window.removeEventListener(type, restart, LISTENER_OPTIONS),
      );
    };
  }, [isWaiting, calmMs, onCalm]);
}
