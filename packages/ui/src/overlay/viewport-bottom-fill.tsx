'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export type ViewportBottomFillTone = 'panel' | 'backdrop';

function subscribeToViewport(onChange: () => void) {
  window.addEventListener('resize', onChange);
  window.addEventListener('scroll', onChange, { passive: true });
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('scroll', onChange);
  };
}

function readLayoutViewportBottom(): number {
  return window.scrollY + window.innerHeight;
}

function readNothingOnServer(): null {
  return null;
}

export function ViewportBottomFill({ tone }: { tone: ViewportBottomFillTone }) {
  const top = useSyncExternalStore(
    subscribeToViewport,
    readLayoutViewportBottom,
    readNothingOnServer,
  );

  if (top === null) return null;

  return createPortal(
    <div aria-hidden className="viewport-bottom-fill" data-tone={tone} style={{ top }} />,
    document.body,
  );
}
