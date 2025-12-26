/**
 * Skeleton loading placeholder component.
 *
 * Displays animated placeholder while content is loading.
 */

import { cn } from '@/shared/utils';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

/**
 * Animated skeleton placeholder.
 *
 * @example
 * <Skeleton className="h-4 w-32" />
 * <Skeleton className="h-40 w-full rounded-xl" />
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-zinc-800', className)}
      {...props}
    />
  );
}

export { Skeleton };
