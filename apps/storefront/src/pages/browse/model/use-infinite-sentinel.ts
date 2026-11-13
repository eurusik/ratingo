'use client';

import { useEffect, useRef } from 'react';

const PRELOAD_MARGIN = '800px 0px';

export function useInfiniteSentinel(onReach: () => void, isEnabled: boolean, loadedCount: number) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onReachRef = useRef(onReach);

  useEffect(() => {
    onReachRef.current = onReach;
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !isEnabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onReachRef.current();
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isEnabled, loadedCount]);

  return sentinelRef;
}
