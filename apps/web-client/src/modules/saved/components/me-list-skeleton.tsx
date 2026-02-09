import { Skeleton } from '@/shared/ui';

/**
 * Loading skeleton for me-list pages (history, watchlist, paused).
 * Renders a 6-card grid with poster + text placeholders.
 */
export function MeListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-lg bg-cinema-card/50">
          <Skeleton className="w-16 h-24 rounded-md shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
