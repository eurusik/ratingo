import { Skeleton } from '@heroui/react';

const PLACEHOLDER_CARDS = [0, 1];

export function ReviewsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {PLACEHOLDER_CARDS.map((card) => (
        <div key={card} className="flex flex-col gap-3 rounded-3xl bg-surface p-3.5 md:p-5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-4/5 rounded-full" />
        </div>
      ))}
    </div>
  );
}
