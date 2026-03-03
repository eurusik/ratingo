/**
 * Infinite scroll loader component.
 * Uses Intersection Observer to trigger loading more items.
 */

'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollLoaderProps {
  /** Callback when loader becomes visible */
  onLoadMore: () => void;
  /** Whether currently loading */
  isLoading: boolean;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Loading text */
  loadingText?: string;
}

/**
 * Infinite scroll trigger.
 * Calls onLoadMore when element enters viewport.
 */
export function InfiniteScrollLoader({
  onLoadMore,
  isLoading,
  hasMore,
  loadingText = 'Loading...',
}: InfiniteScrollLoaderProps) {
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoading) return;

    const currentRef = loaderRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.unobserve(currentRef);
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' },
    );

    observer.observe(currentRef);

    return () => {
      observer.unobserve(currentRef);
    };
  }, [hasMore, isLoading, onLoadMore]);

  if (!hasMore && !isLoading) {
    return null;
  }

  return (
    <div ref={loaderRef} className="flex items-center justify-center py-8">
      {isLoading && (
        <div className="flex items-center gap-2 text-cinema-text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{loadingText}</span>
        </div>
      )}
    </div>
  );
}
