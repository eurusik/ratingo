/**
 * Loading skeleton for journal post detail page.
 */

import { Skeleton } from '@/shared/ui/skeleton';

export default function JournalPostLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article>
          {/* Back link */}
          <div className="mb-6">
            <Skeleton className="h-9 w-32" />
          </div>

          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-4 w-36" />
            </div>

            <Skeleton className="h-10 w-3/4 mb-6" />

            {/* Featured image placeholder */}
            <Skeleton className="aspect-video w-full rounded-lg mb-6" />
          </header>

          {/* Content skeleton */}
          <div className="space-y-4 mb-12">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="py-2" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Navigation skeleton */}
          <div className="pt-8 border-t flex justify-between">
            <Skeleton className="h-12 w-40" />
            <Skeleton className="h-12 w-40" />
          </div>
        </article>
      </div>
    </div>
  );
}
