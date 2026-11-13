import { Skeleton } from '@heroui/react';
import { PosterTileSkeleton } from '@/entities/media';

const SKELETON_TILES = 12;

export function BrowseSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-10 md:px-0 md:pt-4" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1 rounded-full md:max-w-40" />
        <Skeleton className="h-11 w-48 rounded-full md:w-56" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <Skeleton className="h-4 w-56 rounded-full" />
      <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 md:grid-cols-5 md:gap-x-4 lg:grid-cols-6">
        {Array.from({ length: SKELETON_TILES }, (_, index) => (
          <PosterTileSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
