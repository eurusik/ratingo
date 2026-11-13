'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

const EDGE_TOLERANCE_PX = 2;
const ACTIVE_ITEM_SELECTOR = '[aria-current="page"]';

export interface ScrollEdges {
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

function readEdges(element: HTMLElement): ScrollEdges {
  const scrolled = Math.abs(element.scrollLeft);
  return {
    hasMoreBefore: scrolled > EDGE_TOLERANCE_PX,
    hasMoreAfter: scrolled + element.clientWidth < element.scrollWidth - EDGE_TOLERANCE_PX,
  };
}

function useScrollEdges(ref: RefObject<HTMLElement | null>, contentKey: string): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ hasMoreBefore: false, hasMoreAfter: false });

  useEffect(() => {
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

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      resizeObserver.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [ref, contentKey]);

  return edges;
}

function isFullyVisible(item: HTMLElement, container: HTMLElement): boolean {
  const itemBox = item.getBoundingClientRect();
  const containerBox = container.getBoundingClientRect();
  return itemBox.left >= containerBox.left && itemBox.right <= containerBox.right;
}

function useActiveItemInView(ref: RefObject<HTMLElement | null>, activeKey: string) {
  const hasMounted = useRef(false);

  useEffect(() => {
    const behavior: ScrollBehavior = hasMounted.current ? 'smooth' : 'instant';
    hasMounted.current = true;

    const container = ref.current;
    const item = container?.querySelector<HTMLElement>(ACTIVE_ITEM_SELECTOR);
    if (!container || !item || isFullyVisible(item, container)) return;

    const centeredLeft = item.offsetLeft - (container.clientWidth - item.offsetWidth) / 2;
    container.scrollTo({ left: centeredLeft, behavior });
  }, [ref, activeKey]);
}

export function useHorizontalScroller<T extends HTMLElement>(activeKey: string) {
  const ref = useRef<T>(null);
  const edges = useScrollEdges(ref, activeKey);
  useActiveItemInView(ref, activeKey);
  return { ref, edges };
}
