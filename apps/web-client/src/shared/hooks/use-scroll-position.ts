/**
 * Hook to track scroll position.
 * Returns whether user has scrolled past a threshold.
 */

'use client';

import { useEffect, useState } from 'react';

interface UseScrollPositionOptions {
  /** Scroll threshold in pixels (default: 100) */
  threshold?: number;
}

/**
 * Tracks scroll position and returns whether scrolled past threshold.
 */
export function useScrollPosition({ threshold = 100 }: UseScrollPositionOptions = {}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > threshold);
    };

    // Check initial position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return isScrolled;
}
