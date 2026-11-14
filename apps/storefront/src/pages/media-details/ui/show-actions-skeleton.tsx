'use client';

import { Skeleton } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { useTrackingGuess } from '../model/tracking-guess';
import { ActionsSkeleton } from './actions-skeleton';

const CARD = 'flex flex-col gap-3 rounded-3xl bg-surface/45 p-4';

function TextLine({ className, width }: { className: string; width: string }) {
  return (
    <span aria-hidden className={cn('block', className)}>
      <Skeleton className={cn('inline-block h-[0.85em] align-middle', width)} />
    </span>
  );
}

function StartSkeleton() {
  return (
    <div className={CARD}>
      <div>
        <TextLine className="text-[17px] font-extrabold" width="w-40 rounded-md" />
        <TextLine className="mt-1 text-sm" width="w-52 rounded-md" />
      </div>
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <Skeleton className="h-13 w-full rounded-full md:flex-1" />
        <div className="flex gap-2.5">
          <Skeleton className="h-12 flex-1 rounded-full md:w-48 md:flex-none" />
          <Skeleton className="h-12 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function WatchingSkeleton({ hasUpcoming }: { hasUpcoming: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className={CARD}>
        <div className="flex min-h-tap items-center justify-between gap-2.5">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-28 rounded-md" />
        </div>
        <Skeleton className="mb-1 h-1 w-full rounded-xs" />
        <div className="flex min-h-[4.125rem] items-center gap-3">
          <Skeleton className="h-13 w-22 shrink-0 rounded-[10px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-12 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
          <Skeleton className="size-13 shrink-0 rounded-full" />
        </div>
        {hasUpcoming ? (
          <TextLine
            className="border-t border-separator pt-2.5 text-[13px]"
            width="w-48 rounded-md"
          />
        ) : null}
      </div>
      <Skeleton className="h-13 w-full rounded-full md:w-32" />
    </div>
  );
}

interface ShowActionsSkeletonProps {
  showId?: string;
  hasUpcoming: boolean;
}

export function ShowActionsSkeleton({ showId, hasUpcoming }: ShowActionsSkeletonProps) {
  const guess = useTrackingGuess(showId);

  if (guess === 'watching') return <WatchingSkeleton hasUpcoming={hasUpcoming} />;
  if (guess === 'start') return <StartSkeleton />;
  return <ActionsSkeleton type="show" />;
}
