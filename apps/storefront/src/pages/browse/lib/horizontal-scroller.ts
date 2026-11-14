'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

const EDGE_TOLERANCE_PX = 2;
const ACTIVE_ITEM_SELECTOR = '[aria-current="page"]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const EDGE_FADE_REM = 2.5;

export interface ScrollEdges {
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

export function readEdges(element: HTMLElement): ScrollEdges {
  const scrolled = Math.abs(element.scrollLeft);
  return {
    hasMoreBefore: scrolled > EDGE_TOLERANCE_PX,
    hasMoreAfter: scrolled + element.clientWidth < element.scrollWidth - EDGE_TOLERANCE_PX,
  };
}

function useScrollEdges(ref: RefObject<HTMLElement | null>, contentKey: string): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ hasMoreBefore: false, hasMoreAfter: false });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const next = readEdges(element);
      setEdges((previous) =>
        previous.hasMoreBefore === next.hasMoreBefore && previous.hasMoreAfter === next.hasMoreAfter
          ? previous
          : next,
      );
    };

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);
    for (const item of element.children) resizeObserver.observe(item);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      resizeObserver.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [ref, contentKey]);

  return edges;
}

function edgeFadePx(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) * EDGE_FADE_REM;
}

function isClearOfFades(item: HTMLElement, container: HTMLElement): boolean {
  const itemBox = item.getBoundingClientRect();
  const containerBox = container.getBoundingClientRect();
  const { hasMoreBefore, hasMoreAfter } = readEdges(container);
  const fade = edgeFadePx();
  return (
    itemBox.left >= containerBox.left + (hasMoreBefore ? fade : 0) &&
    itemBox.right <= containerBox.right - (hasMoreAfter ? fade : 0)
  );
}

function scrollBehaviorFor(isChange: boolean): ScrollBehavior {
  return isChange && !window.matchMedia(REDUCED_MOTION_QUERY).matches ? 'smooth' : 'instant';
}

function useActiveItemInView(ref: RefObject<HTMLElement | null>, activeKey: string) {
  const previousKey = useRef(activeKey);

  useLayoutEffect(() => {
    const isChange = previousKey.current !== activeKey;
    previousKey.current = activeKey;

    const container = ref.current;
    const item = container?.querySelector<HTMLElement>(ACTIVE_ITEM_SELECTOR);
    if (!container || !item || isClearOfFades(item, container)) return;

    const centeredLeft = item.offsetLeft - (container.clientWidth - item.offsetWidth) / 2;
    container.scrollTo({ left: centeredLeft, behavior: scrollBehaviorFor(isChange) });
  }, [ref, activeKey]);
}

interface HorizontalScrollerOptions {
  activeKey: string;
  contentKey: string;
}

export function useHorizontalScroller<T extends HTMLElement>({
  activeKey,
  contentKey,
}: HorizontalScrollerOptions) {
  const ref = useRef<T>(null);
  useActiveItemInView(ref, activeKey);
  const edges = useScrollEdges(ref, contentKey);
  return { ref, edges };
}
