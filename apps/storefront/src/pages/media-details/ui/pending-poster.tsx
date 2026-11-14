'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Skeleton } from '@heroui/react';
import { reportNavigationStep } from '@ratingo/ui/motion';
import { SHARED_ART_TARGET } from '@/shared/lib';
import { markSkeletonShownFor } from '../model/skeleton-reveal';
import { ArrivingArt } from './arriving-art';

export function PendingPoster() {
  const pathname = usePathname() ?? '';
  useEffect(() => {
    markSkeletonShownFor(pathname);
    reportNavigationStep('skeleton-shown', { pathname });
  }, [pathname]);

  return (
    <span
      {...SHARED_ART_TARGET}
      className="relative block aspect-2/3 w-full overflow-hidden rounded-[14px] [grid-area:poster] md:rounded-[20px]"
    >
      <ArrivingArt fallback={<Skeleton className="size-full rounded-none" />} />
    </span>
  );
}
