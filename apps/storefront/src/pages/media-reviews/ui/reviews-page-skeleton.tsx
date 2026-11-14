import { Skeleton } from '@heroui/react';

const PLACEHOLDER_CARDS = [0, 1, 2];

export function ReviewsPageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4 px-4 pt-14 pb-10 md:px-0 md:pt-0">
      <Skeleton className="hidden h-9 w-80 rounded-full md:block" />
      <Skeleton className="h-11 w-full rounded-full md:w-96" />
      {PLACEHOLDER_CARDS.map((card) => (
        <div key={card} className="flex flex-col gap-3 rounded-3xl bg-surface p-3.5 md:max-w-[calc(100%-23rem)] md:p-5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-3.5 w-28 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-3/4 rounded-full" />
        </div>
      ))}
    </div>
  );
}
