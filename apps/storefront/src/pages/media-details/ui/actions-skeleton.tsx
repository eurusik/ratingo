import { Skeleton } from '@heroui/react';
import type { MediaType } from '@/shared/api';

export function MoreMenuSkeleton() {
  return <Skeleton className="hidden size-13 shrink-0 rounded-full md:block" />;
}

export function ActionsSkeleton({ type }: { type: MediaType }) {
  if (type === 'show') return <Skeleton className="h-52 w-full rounded-3xl md:h-43.25" />;
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="h-13 min-w-0 flex-1 rounded-full md:w-51 md:flex-none" />
      <Skeleton className="h-13 w-31 shrink-0 rounded-full" />
      <MoreMenuSkeleton />
    </div>
  );
}
