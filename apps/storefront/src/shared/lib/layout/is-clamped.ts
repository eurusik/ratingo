'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const CLAMP_TOLERANCE_PX = 1;

export function useIsClamped<T extends HTMLElement>(isExpanded: boolean, likelyClamped: boolean) {
  const ref = useRef<T>(null);
  const [isClamped, setIsClamped] = useState(likelyClamped);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || isExpanded) return;
    const measure = () =>
      setIsClamped(element.scrollHeight > element.clientHeight + CLAMP_TOLERANCE_PX);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isExpanded]);

  return { ref, isClamped };
}
