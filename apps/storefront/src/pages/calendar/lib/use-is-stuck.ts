'use client';

import { useRef } from 'react';
import { useScrollSyncedState } from './use-scroll-synced-state';

function stickyTop(element: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(element).top) || 0;
}

export function useIsStuck<Sticky extends HTMLElement>() {
  const sentinel = useRef<HTMLDivElement>(null);
  const sticky = useRef<Sticky>(null);
  const isStuck = useScrollSyncedState(
    false,
    () => {
      if (!sentinel.current || !sticky.current) return undefined;
      return { value: sentinel.current.getBoundingClientRect().top < stickyTop(sticky.current) };
    },
    { affectsLayout: true },
  );

  return { sentinel, sticky, isStuck };
}
