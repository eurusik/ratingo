import { Skeleton } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { WEEK_LENGTH } from '../model/calendar-dates';
import {
  CALENDAR_ROOT,
  DAY_HEADING_TEXT,
  DAY_SECTION,
  DAY_STRIP,
  dayTileHeight,
  EPISODE_LIST,
  EPISODE_ROW,
  HEADER_ROW,
  MODE_PILLS_SKELETON,
  WEEK_ARROW_SIZE,
  WEEK_STRIP_PANE,
  WEEK_STRIP_SCROLLER,
  WEEK_BAR_FRAME,
} from './calendar-layout';

const SKELETON_DAYS = 2;
const SKELETON_ROWS = 3;

function EpisodeSkeleton() {
  return (
    <li className={EPISODE_ROW}>
      <Skeleton className="h-[63px] w-28 shrink-0 rounded-[10px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/5 rounded-full" />
        <Skeleton className="h-3 w-4/5 rounded-full" />
      </span>
    </li>
  );
}

export function CalendarListSkeleton({ label }: { label: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden>
        {Array.from({ length: SKELETON_DAYS }, (_, day) => (
          <div key={day} className={DAY_SECTION}>
            <div className={cn(DAY_HEADING_TEXT, 'mb-2 md:mb-0')}>
              <Skeleton className="h-[1lh] w-36 rounded-full" />
            </div>
            <ul className={EPISODE_LIST}>
              {Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <EpisodeSkeleton key={row} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeekStripSkeleton({ isCompact = false }: { isCompact?: boolean }) {
  return (
    <div aria-hidden className={DAY_STRIP}>
      {Array.from({ length: WEEK_LENGTH }, (_, index) => (
        <div
          key={index}
          className={cn(
            'flex flex-col items-center justify-center gap-1 md:block',
            dayTileHeight(isCompact),
          )}
        >
          {isCompact ? null : <Skeleton className="h-4 w-5 rounded-full md:hidden" />}
          <Skeleton className="size-10 rounded-full md:size-full md:rounded-2xl" />
          <span className="h-1.25 md:hidden" />
        </div>
      ))}
    </div>
  );
}

export function CalendarPageSkeleton({ label }: { label: string }) {
  return (
    <div className={CALENDAR_ROOT}>
      <div aria-hidden className={cn(HEADER_ROW, 'max-md:hidden')}>
        <Skeleton className="h-10 w-48 rounded-xl" />
        <span className="h-7 w-px shrink-0 bg-separator" />
        <Skeleton className={MODE_PILLS_SKELETON} />
      </div>
      <div aria-hidden className={WEEK_BAR_FRAME}>
        <div className="flex min-h-11 items-center gap-1.5">
          <Skeleton className={cn(MODE_PILLS_SKELETON, 'md:hidden')} />
          <span className="flex-1 md:hidden" />
          <Skeleton className="me-1 size-7.5 shrink-0 rounded-[9px] md:hidden" />
          <div className="flex flex-1 flex-col gap-1.5 max-md:hidden">
            <Skeleton className="h-5 w-32 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <Skeleton className={cn('hidden md:block', WEEK_ARROW_SIZE)} />
          <Skeleton className={cn('hidden md:block', WEEK_ARROW_SIZE)} />
        </div>
        <div className={WEEK_STRIP_SCROLLER}>
          <div className={WEEK_STRIP_PANE}>
            <WeekStripSkeleton />
          </div>
        </div>
      </div>
      <CalendarListSkeleton label={label} />
    </div>
  );
}
