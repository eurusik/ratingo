'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { onViewportChange, scheduleFrame } from './viewport-frames';

type Measure<T> = () => { value: T } | undefined;

interface ScrollSyncOptions {
  watchedSubtree?: RefObject<HTMLElement | null>;
  affectsLayout?: boolean;
}

export function useScrollSyncedState<T>(
  initial: T,
  measure: Measure<T>,
  { watchedSubtree, affectsLayout = false }: ScrollSyncOptions = {},
): T {
  const [value, setValue] = useState(initial);
  const latest = useRef({ measure, rendered: value });

  useLayoutEffect(() => {
    latest.current.measure = measure;
    latest.current.rendered = value;
  });

  useLayoutEffect(() => {
    let isActive = true;
    const sync = () => {
      const measured = latest.current.measure();
      if (!measured || measured.value === latest.current.rendered) return;
      if (affectsLayout) flushSync(() => setValue(measured.value));
      else setValue(measured.value);
    };
    const changes = new MutationObserver(() => scheduleFrame(sync));

    const observeAfterRefsAttach = () => {
      if (!isActive) return;
      const subtree = watchedSubtree?.current;
      if (subtree) changes.observe(subtree, { childList: true, subtree: true });
      sync();
    };

    queueMicrotask(observeAfterRefsAttach);
    const stopListening = onViewportChange(sync);
    return () => {
      isActive = false;
      changes.disconnect();
      stopListening();
    };
  }, [watchedSubtree, affectsLayout]);

  return value;
}
