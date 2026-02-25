'use client';

/**
 * Week navigation bar for the calendar view.
 *
 * Displays the current week's date range with previous/next arrow buttons and
 * an optional "Цей тиждень" reset link. Sticky on mobile, static on ≥sm.
 *
 * Navigation is capped at ±4 weeks from today — arrow buttons are disabled
 * beyond those bounds.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDictionary, type Locale } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Button } from '@/shared/ui/button';

export interface CalendarWeekNavProps {
  /** Week start date in YYYY-MM-DD format. */
  startDate: string;
  /** Number of days to show (typically 7). */
  days: number;
  /** Whether the displayed week is the current calendar week. */
  isCurrentWeek: boolean;
  /** When true, disables the arrow buttons to prevent interaction during fetch. */
  isLoading?: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  /** Reset navigation back to the current week. */
  onThisWeek: () => void;
  /** Today's date (YYYY-MM-DD), passed from parent to avoid hydration mismatch. */
  today?: string;
  locale?: Locale;
}

/** Maximum offset (in days) allowed in either direction from today. */
const MAX_OFFSET_DAYS = 28;

/**
 * Formats a week date range as a human-readable string.
 *
 * @example
 * formatWeekRange('2024-02-19', 7, 'uk') // "19 лют — 25 лют"
 */
function formatWeekRange(startDate: string, days: number, locale: Locale): string {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(startDate + 'T00:00:00');
  end.setDate(end.getDate() + days - 1);

  const loc = locale === 'uk' ? 'uk-UA' : 'en-US';
  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

  return `${start.toLocaleDateString(loc, fmt)} — ${end.toLocaleDateString(loc, fmt)}`;
}

/**
 * Returns today's date as a YYYY-MM-DD string normalised to midnight local time.
 */
function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the number of days between two YYYY-MM-DD date strings.
 * Positive when `b` is after `a`.
 */
function diffDays(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const dateA = new Date(a + 'T00:00:00').getTime();
  const dateB = new Date(b + 'T00:00:00').getTime();
  return Math.round((dateB - dateA) / msPerDay);
}

/**
 * Week navigation component.
 *
 * @example
 * <CalendarWeekNav
 *   startDate="2024-02-19"
 *   days={7}
 *   isCurrentWeek={false}
 *   onPrevWeek={handlePrev}
 *   onNextWeek={handleNext}
 *   onThisWeek={handleReset}
 *   locale="uk"
 * />
 */
export function CalendarWeekNav({
  startDate,
  days,
  isCurrentWeek,
  isLoading = false,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  today: todayProp,
  locale = 'uk',
}: CalendarWeekNavProps) {
  const dict = getDictionary(locale);
  const today = todayProp ?? getTodayDateString();

  // Offset of the current week's start relative to today (negative = past).
  const offsetFromToday = diffDays(today, startDate);

  const isPrevDisabled = isLoading || offsetFromToday <= -MAX_OFFSET_DAYS;
  const isNextDisabled = isLoading || offsetFromToday >= MAX_OFFSET_DAYS;

  const rangeLabel = formatWeekRange(startDate, days, locale);

  return (
    <div
      className={cn(
        'sticky top-14 z-10 bg-cinema-page/95 backdrop-blur-sm py-3 -mx-4 px-4',
        'sm:static sm:bg-transparent sm:backdrop-blur-none sm:mx-0 sm:px-0',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Previous week */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevWeek}
          disabled={isPrevDisabled}
          aria-label="Попередній тиждень"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Center: date range + "this week" reset link */}
        <div className="flex flex-col items-center gap-1 min-w-0">
          <time
            dateTime={startDate}
            className="text-sm font-medium text-cinema-text-primary leading-tight"
          >
            {rangeLabel}
          </time>

          {!isCurrentWeek && (
            <button
              type="button"
              onClick={onThisWeek}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {dict.calendar.thisWeek}
            </button>
          )}
        </div>

        {/* Next week */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextWeek}
          disabled={isNextDisabled}
          aria-label="Наступний тиждень"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
