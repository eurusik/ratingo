import { Card, Skeleton } from '@heroui/react';

export function TrendingCardSkeleton() {
  return (
    <Card className="w-77.5 gap-0 overflow-hidden rounded-3xl p-0 md:w-full">
      <Skeleton className="h-62.5 w-full rounded-none" />
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 flex-1 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-28 rounded-full" />
      </div>
    </Card>
  );
}

export function TopRankTileSkeleton() {
  return (
    <div className="flex w-24 flex-col gap-1.5 md:w-full md:gap-2">
      <Skeleton className="h-36 w-24 rounded-xl md:aspect-2/3 md:h-auto md:w-full" />
      <div className="flex min-h-[2lh] flex-col justify-around text-[13px] leading-tight md:text-sm">
        <Skeleton className="h-[0.8em] w-4/5 rounded-full" />
        <Skeleton className="h-[0.8em] w-1/2 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-14 rounded-full" />
      </div>
    </div>
  );
}

export function PosterTileSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 md:gap-2">
      <Skeleton className="aspect-2/3 w-full rounded-xl" />
      <div className="flex min-h-[2lh] flex-col justify-around text-[13px] leading-tight md:text-sm">
        <Skeleton className="h-[0.8em] w-4/5 rounded-full" />
        <Skeleton className="h-[0.8em] w-1/2 rounded-full" />
      </div>
      <Skeleton className="h-7 w-16 rounded-full" />
    </div>
  );
}
