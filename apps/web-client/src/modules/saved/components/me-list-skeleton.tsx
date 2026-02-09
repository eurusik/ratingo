import { Skeleton } from '@/shared/ui';

/**
 * Render the loading skeleton grid for "me-list" pages (history, watchlist, paused).
 *
 * Displays six skeleton cards; each card shows a poster placeholder and three text placeholders.
 *
 * @returns The React element representing the six-item loading skeleton grid.
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