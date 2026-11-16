'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motionScrollBehavior } from '@/shared/lib';

export type WeekStep = -1 | 1;

export const WEEK_PANES = ['previous', 'current', 'next'] as const;

export const CURRENT_PANE = WEEK_PANES.indexOf('current');

const SETTLE_FALLBACK_MS = 120;

function stepOfPane(pane: number): number {
  return pane - CURRENT_PANE;
}

function weekStepOf(pane: number): WeekStep | undefined {
  const step = stepOfPane(pane);
  if (step === 0) return undefined;
  return step > 0 ? 1 : -1;
}

function paneOfStep(step: WeekStep): number {
  return CURRENT_PANE + step;
}

function paneAt(scroller: HTMLElement, pane: number): HTMLElement | undefined {
  const element = scroller.children[pane];
  return element instanceof HTMLElement ? element : undefined;
}

function paneScrollLeft(scroller: HTMLElement, pane: number): number {
  const element = paneAt(scroller, pane);
  if (!element) return scroller.scrollLeft;
  return element.offsetLeft + element.offsetWidth / 2 - scroller.clientWidth / 2;
}

function nearestPane(scroller: HTMLElement): number {
  const center = scroller.scrollLeft + scroller.clientWidth / 2;
  let nearest = CURRENT_PANE;
  let distance = Number.POSITIVE_INFINITY;
  [...scroller.children].forEach((child, pane) => {
    if (!(child instanceof HTMLElement)) return;
    const offset = Math.abs(child.offsetLeft + child.offsetWidth / 2 - center);
    if (offset < distance) {
      distance = offset;
      nearest = pane;
    }
  });
  return nearest;
}

function recentre(scroller: HTMLElement): void {
  scroller.scrollLeft = paneScrollLeft(scroller, CURRENT_PANE);
}

function scrollToPane(scroller: HTMLElement, pane: number): void {
  scroller.scrollTo({ left: paneScrollLeft(scroller, pane), behavior: motionScrollBehavior() });
}

function isScrollable(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth;
}

function supportsScrollEnd(): boolean {
  return 'onscrollend' in window;
}

interface PanePreview {
  weekKey: string;
  pane: number;
}

export function useWeekCarousel(weekKey: string, tryStep: (step: WeekStep) => boolean) {
  const scroller = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<PanePreview>({ weekKey, pane: CURRENT_PANE });
  const latest = useRef({
    weekKey,
    tryStep,
    lastCommittedWeek: undefined as string | undefined,
    isSliding: false,
    queuedSteps: [] as WeekStep[],
  });

  useLayoutEffect(() => {
    latest.current.weekKey = weekKey;
    latest.current.tryStep = tryStep;
  });

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    recentre(element);
    const state = latest.current;
    state.lastCommittedWeek = undefined;
    const queued = state.queuedSteps.shift();
    state.isSliding = queued !== undefined;
    if (queued !== undefined)
      requestAnimationFrame(() => scrollToPane(element, paneOfStep(queued)));
  }, [weekKey]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isTouching = false;
    const waitsForScrollEnd = supportsScrollEnd();

    const stopSliding = () => {
      latest.current.isSliding = false;
      latest.current.queuedSteps = [];
    };
    const commit = () => {
      clearTimeout(timer);
      const state = latest.current;
      if (isTouching || state.lastCommittedWeek === state.weekKey) return;
      const step = weekStepOf(nearestPane(element));
      if (step === undefined) return;
      state.lastCommittedWeek = state.weekKey;
      if (state.tryStep(step)) return;
      state.lastCommittedWeek = undefined;
      stopSliding();
      scrollToPane(element, CURRENT_PANE);
    };
    const commitLater = () => {
      clearTimeout(timer);
      timer = setTimeout(commit, SETTLE_FALLBACK_MS);
    };
    const onScroll = () => {
      const pane = nearestPane(element);
      const { weekKey: shownWeek } = latest.current;
      setPreview((previous) =>
        previous.weekKey === shownWeek && previous.pane === pane
          ? previous
          : { weekKey: shownWeek, pane },
      );
      if (!waitsForScrollEnd) commitLater();
    };
    const onTouchStart = () => {
      isTouching = true;
      stopSliding();
    };
    const onTouchEnd = () => {
      isTouching = false;
      if (!waitsForScrollEnd) commitLater();
    };
    const keepCentred = new ResizeObserver(() => recentre(element));

    keepCentred.observe(element);
    element.addEventListener('scroll', onScroll, { passive: true });
    element.addEventListener('scrollend', commit);
    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('wheel', stopSliding, { passive: true });
    element.addEventListener('pointerdown', stopSliding, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      clearTimeout(timer);
      keepCentred.disconnect();
      element.removeEventListener('scroll', onScroll);
      element.removeEventListener('scrollend', commit);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('wheel', stopSliding);
      element.removeEventListener('pointerdown', stopSliding);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const slideTo = useCallback((step: WeekStep) => {
    const element = scroller.current;
    if (!element || !isScrollable(element)) {
      void latest.current.tryStep(step);
      return;
    }
    const state = latest.current;
    if (state.isSliding) {
      state.queuedSteps.push(step);
      return;
    }
    state.isSliding = true;
    scrollToPane(element, paneOfStep(step));
  }, []);

  return {
    scroller,
    previewStep: preview.weekKey === weekKey ? stepOfPane(preview.pane) : 0,
    slideTo,
  };
}
