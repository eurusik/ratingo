'use client';

import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { OverlayTriggerStateContext } from 'react-aria-components';

export type ViewportBottomFillTone = 'panel' | 'backdrop';

const PANEL_SELECTOR = '.sheet__dialog, [data-slot="drawer-dialog"], .drawer__dialog';
const SETTLED_FRAME_COUNT = 30;
const WAKE_EVENTS = ['scroll', 'touchmove', 'transitionrun', 'animationstart'] as const;

const subscribeToNothing = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

function fillTop(panelTop: number | null, tone: ViewportBottomFillTone): number {
  const layoutBottom = window.innerHeight;
  if (tone === 'backdrop' || panelTop === null) return window.scrollY + layoutBottom;
  return window.scrollY + Math.max(layoutBottom, panelTop);
}

export function ViewportBottomFill({ tone }: { tone: ViewportBottomFillTone }) {
  const overlay = useContext(OverlayTriggerStateContext);
  const isClient = useIsClient();
  const markerRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const isOpen = overlay?.isOpen !== false;

  useEffect(() => {
    if (!isOpen) return;
    const panel = markerRef.current?.closest<HTMLElement>(PANEL_SELECTOR) ?? null;
    let frame = 0;
    let settledFrames = 0;
    let lastTop = Number.NaN;

    const render = () => {
      const panelTop = panel ? panel.getBoundingClientRect().top : null;
      const top = fillTop(panelTop, tone);
      if (fillRef.current) fillRef.current.style.top = `${top}px`;
      if (edgeRef.current) {
        const panelBelowViewport =
          tone === 'panel' && panelTop !== null && panelTop >= window.innerHeight;
        edgeRef.current.style.visibility = panelBelowViewport ? 'hidden' : '';
      }
      return top;
    };

    const track = () => {
      const top = render();
      settledFrames = top === lastTop ? settledFrames + 1 : 0;
      lastTop = top;
      frame = settledFrames < SETTLED_FRAME_COUNT ? requestAnimationFrame(track) : 0;
    };

    const wake = () => {
      settledFrames = 0;
      if (frame === 0) frame = requestAnimationFrame(track);
    };

    wake();
    WAKE_EVENTS.forEach((type) =>
      document.addEventListener(type, wake, { capture: true, passive: true }),
    );
    window.addEventListener('resize', wake);
    return () => {
      cancelAnimationFrame(frame);
      WAKE_EVENTS.forEach((type) => document.removeEventListener(type, wake, { capture: true }));
      window.removeEventListener('resize', wake);
    };
  }, [isOpen, tone]);

  if (!isClient || !isOpen) return null;

  return (
    <>
      <span ref={markerRef} hidden />
      {createPortal(
        <>
          <div ref={fillRef} aria-hidden className="viewport-bottom-fill" data-tone={tone} />
          <div ref={edgeRef} aria-hidden className="viewport-bottom-edge" data-tone={tone} />
        </>,
        document.body,
      )}
    </>
  );
}
