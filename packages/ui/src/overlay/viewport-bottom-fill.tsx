'use client';

import { useContext, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { OverlayTriggerStateContext } from 'react-aria-components';

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
  const overlay = useContext(OverlayTriggerStateContext);
  const top = useSyncExternalStore(
    subscribeToViewport,
    readLayoutViewportBottom,
    readNothingOnServer,
  );

  if (top === null || overlay?.isOpen === false) return null;

  return createPortal(
    <>
      <div aria-hidden className="viewport-bottom-fill" data-tone={tone} style={{ top }} />
      <div aria-hidden className="viewport-bottom-edge" data-tone={tone} />
    </>,
    document.body,
  );
}
