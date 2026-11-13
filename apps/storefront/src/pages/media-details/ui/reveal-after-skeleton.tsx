'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { DETAILS_REVEAL_SELECTOR } from '../model/details-reveal';
import { consumeSkeletonShownFor } from '../model/skeleton-reveal';

const REVEAL_MS = 250;

export function RevealAfterSkeleton() {
  const pathname = usePathname() ?? '';

  useLayoutEffect(() => {
    if (!consumeSkeletonShownFor(pathname)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll(DETAILS_REVEAL_SELECTOR).forEach((element) => {
      element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: REVEAL_MS,
        easing: 'ease-out',
      });
    });
  }, [pathname]);

  return null;
}
