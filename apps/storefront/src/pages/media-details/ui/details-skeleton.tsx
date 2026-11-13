import { Skeleton } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { ACTIONS_SKELETON_SIZE } from '../model/actions-skeleton-size';
import { PendingPoster } from './pending-poster';

interface DetailsSkeletonProps {
  label: string;
  type: MediaType;
}

export function DetailsSkeleton({ label, type }: DetailsSkeletonProps) {
  return (
    <div role="status" className="flex flex-col gap-7 pb-10 md:gap-10">
      <span className="sr-only">{label}</span>
      <div className="relative -mt-(--page-top) pb-2 md:-mx-(--page-gutter) md:pb-14">
        <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden">
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="hero-fade absolute inset-0" />
        </div>
        <div className="relative flex flex-col gap-7 px-4 pt-55 md:gap-16 md:px-(--page-gutter) md:pt-[calc(var(--page-top)+1.5rem)]">
          <Skeleton className="hidden h-5 w-56 rounded-full md:block" />
          <div className="grid grid-cols-[120px_minmax(0,1fr)] items-end gap-x-4 gap-y-7 [grid-template-areas:'poster_title'_'actions_actions'] md:grid-cols-[240px_minmax(0,1fr)] md:gap-x-10 md:gap-y-5 md:[grid-template-areas:'poster_badge'_'poster_title'_'poster_actions']">
            <PendingPoster />
            <Skeleton className="hidden h-8 w-72 rounded-full [grid-area:badge] md:block" />
            <div className="flex flex-col gap-2.5 pb-0.5 [grid-area:title] md:pb-0">
              <Skeleton className="h-8 w-4/5 rounded-lg md:h-13 md:w-2/3" />
              <Skeleton className="h-4 w-1/2 rounded-full md:h-5 md:w-1/3" />
              <Skeleton className="h-4 w-2/3 rounded-full md:hidden" />
              {type === 'show' ? <Skeleton className="h-6 w-32 rounded-full md:hidden" /> : null}
            </div>
            <Skeleton
              className={`[grid-area:actions] md:mb-2 md:max-w-180 ${ACTIONS_SKELETON_SIZE[type]}`}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-7 px-4 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:gap-x-12 md:gap-y-12 md:px-0">
        <Skeleton className="h-67 w-full rounded-3xl md:col-span-2 md:h-30" />
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-3/4 rounded-full" />
        </div>
        <Skeleton className="hidden h-48 w-full rounded-3xl md:block" />
      </div>
    </div>
  );
}
