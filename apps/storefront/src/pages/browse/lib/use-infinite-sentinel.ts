'use client';

import { useEffect, useRef } from 'react';

const PRELOAD_MARGIN = '200% 0px';

interface InfiniteSentinelOptions {
  onReach: () => void;
  isEnabled: boolean;
  rearmKey: number;
}

export function useInfiniteSentinel({ onReach, isEnabled, rearmKey }: InfiniteSentinelOptions) {
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
  }, [isEnabled, rearmKey]);

  return sentinelRef;
}
