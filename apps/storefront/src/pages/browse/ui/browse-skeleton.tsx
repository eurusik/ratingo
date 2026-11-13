import { Skeleton } from '@heroui/react';
import { BrowseGridSkeleton } from './browse-grid';

export function BrowseSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-4 px-4 pb-10 md:px-0">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1 rounded-full md:max-w-40" />
        <Skeleton className="h-12 w-48 rounded-2xl md:w-56" />
      </div>
      <div aria-hidden className="flex gap-2">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <div aria-hidden className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:pt-2">
        <Skeleton className="hidden h-96 rounded-3xl lg:block" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-56 rounded-full" />
          <BrowseGridSkeleton hasSidebar />
        </div>
      </div>
    </div>
  );
}
