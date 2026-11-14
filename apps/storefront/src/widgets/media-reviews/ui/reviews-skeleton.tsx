import { Skeleton } from '@heroui/react';

const PLACEHOLDER_CARDS = [0, 1];
const SORT_TAB_WIDTHS = ['w-32', 'w-16', 'w-18'];

function ReviewCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-3xl bg-surface p-3.5 md:p-5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-28 rounded-full" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="flex h-24 flex-col justify-center gap-2.5">
        <Skeleton className="h-3.5 w-full rounded-full" />
        <Skeleton className="h-3.5 w-full rounded-full" />
        <Skeleton className="h-3.5 w-3/5 rounded-full" />
      </div>
      <div className="flex h-11 items-center justify-between">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function ReviewsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-23 w-full rounded-3xl md:h-18" />
      {PLACEHOLDER_CARDS.map((card) => (
        <ReviewCardSkeleton key={card} />
      ))}
    </div>
  );
}

export function ReviewsBoardSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:gap-x-12"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <div className="flex min-h-tap items-center">
            <Skeleton className="h-7 w-36 rounded-full md:h-8" />
          </div>
          <div className="flex gap-2">
            {SORT_TAB_WIDTHS.map((width) => (
              <Skeleton key={width} className={`h-11 rounded-full ${width}`} />
            ))}
          </div>
        </div>
        <ReviewsSkeleton />
      </div>
      <Skeleton className="hidden h-30 rounded-3xl md:block" />
    </div>
  );
}
