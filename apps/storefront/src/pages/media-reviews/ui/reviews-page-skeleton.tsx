import { Skeleton } from '@heroui/react';
import { ReviewsBoardSkeleton } from '@/widgets/media-reviews';

export function ReviewsPageSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3 pb-10 md:gap-4">
      <div className="sticky top-0 z-30 -mt-(--page-top) border-b border-separator bg-background/85 pt-safe-top md:hidden">
        <div className="flex h-14 items-center px-4">
          <Skeleton className="size-6 rounded-full" />
        </div>
      </div>
      <div className="hidden min-h-tap items-center md:flex">
        <Skeleton className="h-4 w-24 rounded-full" />
      </div>
      <div className="px-4 md:px-0">
        <ReviewsBoardSkeleton label={label} />
      </div>
    </div>
  );
}
