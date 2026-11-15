'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { reportNavigationStep } from '@ratingo/ui/motion';
import { DETAILS_REVEAL_SELECTOR } from '../model/details-reveal';
import { consumeSkeletonShownFor } from '../model/skeleton-reveal';

const REVEAL_MS = 250;

export function RevealAfterSkeleton() {
  const pathname = usePathname() ?? '';

  useLayoutEffect(() => {
    const wasSkeletonShown = consumeSkeletonShownFor(pathname);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll(DETAILS_REVEAL_SELECTOR);
    reportNavigationStep('details-reveal', {
      wasSkeletonShown,
      prefersReducedMotion,
      targets: targets.length,
    });
    if (!wasSkeletonShown || prefersReducedMotion) return;
    targets.forEach((element) => {
      element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: REVEAL_MS,
        easing: 'ease-out',
      });
    });
  }, [pathname]);

  return null;
}
