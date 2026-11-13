import { Skeleton } from '@heroui/react';

export function DetailsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-7 pb-10 md:gap-10">
      <div className="relative -mt-(--page-top) md:-mx-(--page-gutter) md:mt-0">
        <Skeleton className="absolute inset-x-0 top-0 h-95 rounded-none md:h-140" />
        <div className="relative grid grid-cols-[120px_minmax(0,1fr)] items-end gap-x-4 gap-y-7 px-4 pt-55 md:grid-cols-[240px_minmax(0,1fr)] md:gap-x-10 md:px-(--page-gutter) md:pt-28">
          <Skeleton className="aspect-2/3 w-full rounded-[14px] md:rounded-[20px]" />
          <div className="flex flex-col gap-3 pb-1">
            <Skeleton className="h-8 w-4/5 rounded-lg md:h-13" />
            <Skeleton className="h-4 w-1/2 rounded-full" />
          </div>
          <Skeleton className="col-span-2 h-13 w-full rounded-full md:col-span-1 md:col-start-2 md:w-80" />
        </div>
      </div>
      <div className="flex flex-col gap-7 px-4 md:px-0">
        <Skeleton className="h-44 w-full rounded-3xl md:h-30" />
        <div className="flex flex-col gap-2.5 md:max-w-[calc(100%-23rem)]">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-3/4 rounded-full" />
        </div>
      </div>
    </div>
  );
}
