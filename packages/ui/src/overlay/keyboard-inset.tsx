'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';

function subscribeToVisualViewport(onChange: () => void) {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  viewport.addEventListener('resize', onChange);
  viewport.addEventListener('scroll', onChange);
  return () => {
    viewport.removeEventListener('resize', onChange);
    viewport.removeEventListener('scroll', onChange);
  };
}

function readKeyboardHeight(): number {
  const viewport = window.visualViewport;
  if (!viewport || viewport.scale > 1) return 0;
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}

function readNoKeyboardOnServer(): number {
  return 0;
}

export function KeyboardInset() {
  const keyboardHeight = useSyncExternalStore(
    subscribeToVisualViewport,
    readKeyboardHeight,
    readNoKeyboardOnServer,
  );

  return (
    <span
      aria-hidden
      className="keyboard-inset"
      style={{ '--keyboard-height': `${keyboardHeight}px` } as CSSProperties}
    />
  );
}
