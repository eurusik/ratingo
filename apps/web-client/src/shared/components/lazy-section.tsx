'use client';

/**
 * LazySection - renders children only when section enters viewport.
 *
 * Uses Intersection Observer to defer rendering of below-fold content,
 * reducing initial JS execution and improving LCP/TTI.
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';

interface LazySectionProps {
  children: ReactNode;
  /** Placeholder height to prevent layout shift */
  minHeight?: string;
  /** Root margin for earlier trigger (e.g., "200px" to load 200px before visible) */
  rootMargin?: string;
  /** Optional skeleton to show while loading */
  skeleton?: ReactNode;
  /** Optional className for the wrapper */
  className?: string;
}

export function LazySection({
  children,
  minHeight = '200px',
  rootMargin = '100px',
  skeleton,
  className = '',
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={{ minHeight: isVisible ? undefined : minHeight }}>
      {isVisible ? children : skeleton}
    </div>
  );
}
