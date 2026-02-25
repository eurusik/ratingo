/**
 * Loading skeleton for the calendar view.
 *
 * Renders 5 day groups to reduce visual noise compared to a full 7-day week.
 * Each group contains a date header placeholder and 2 episode card placeholders.
 */

import { Skeleton } from '@/shared/ui/skeleton';

/**
 * Skeleton placeholder for a single episode card row.
 */
function EpisodeCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      {/* Poster placeholder — 48×72px */}
      <Skeleton className="w-12 h-[72px] rounded-md shrink-0" />

      {/* Text lines */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for a single day group (header + 2 cards).
 */
function DayGroupSkeleton() {
  return (
    <div>
      {/* Date header */}
      <Skeleton className="h-6 w-48 mb-2" />

      {/* Episode cards */}
      <div className="space-y-1">
        <EpisodeCardSkeleton />
        <EpisodeCardSkeleton />
      </div>
    </div>
  );
}

/**
 * Full calendar skeleton — 5 day groups.
 */
export function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <DayGroupSkeleton key={i} />
      ))}
    </div>
  );
}
