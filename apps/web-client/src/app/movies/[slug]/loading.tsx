/**
 * Loading state for movie details page.
 */

import { Skeleton } from '@/shared/ui';

export default function MovieLoading() {
  return (
    <main className="min-h-screen">
      {/* Hero skeleton */}
      <div className="relative min-h-[60vh] bg-zinc-900">
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 pt-32 pb-8">
          <div className="flex gap-6 md:gap-10 items-end">
            {/* Poster skeleton */}
            <Skeleton className="w-32 md:w-48 lg:w-56 aspect-[2/3] rounded-xl" />
            
            {/* Info skeleton */}
            <div className="flex-1 space-y-4">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <div className="flex gap-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Tags */}
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>

        {/* Verdict */}
        <Skeleton className="h-32 w-full rounded-2xl" />

        {/* Overview */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </main>
  );
}
