'use client';

/**
 * Main orchestrator for the calendar page.
 *
 * Manages week navigation state, fetches calendar data via useShowCalendar,
 * and delegates rendering to CalendarWeekNav, CalendarDayGroup, CalendarSkeleton,
 * and CalendarEmptyState.
 */

import { useMemo, useState } from 'react';

import { useShowCalendar } from '@/core/query';
import type { CalendarResponseDto } from '@/core/api';
import type { components } from '@ratingo/api-contract';
import { getDictionary, type Locale } from '@/shared/i18n';

import { CalendarWeekNav } from './calendar-week-nav';
import { CalendarDayGroup, type CalendarEpisode } from './calendar-day-group';
import { CalendarSkeleton } from './calendar-skeleton';
import { CalendarEmptyState } from './calendar-empty-state';

export interface CalendarPageClientProps {
  initialData: CalendarResponseDto | null;
  /** Server-rendered today date (YYYY-MM-DD) to avoid hydration mismatch. */
  serverToday: string;
  locale?: Locale;
}

/**
 * Formats a Date to a YYYY-MM-DD string using local time.
 *
 * Using local getters (not UTC) keeps the displayed week aligned with
 * the user's timezone rather than the server's.
 */
function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Normalises a single CalendarEpisodeDto from the API contract to the local
 * CalendarEpisode shape used by CalendarDayGroup.
 *
 * The API contract marks posterPath, overview, runtime, and stillPath as
 * optional (may be undefined). CalendarDayGroup expects them as `T | null`.
 * Coercing undefined to null here keeps all downstream components clean.
 */
function normaliseEpisode(ep: components['schemas']['CalendarEpisodeDto']): CalendarEpisode {
  return {
    showId: ep.showId,
    showSlug: ep.showSlug,
    showTitle: ep.showTitle,
    posterPath: ep.posterPath ?? null,
    seasonNumber: ep.seasonNumber,
    episodeNumber: ep.episodeNumber,
    title: ep.title,
    overview: ep.overview ?? null,
    airDate: ep.airDate,
    runtime: ep.runtime ?? null,
    stillPath: ep.stillPath ?? null,
  };
}

/**
 * Calendar page client component.
 *
 * weekOffset tracks how many weeks the user has navigated from today.
 * 0 = current week, -1 = previous, +1 = next, etc.
 *
 * The current week's initial data is passed from the Server Component so the
 * first render is populated without a client-side round-trip. For any other
 * week the query fetches fresh data.
 *
 * @example
 * <CalendarPageClient initialData={serverFetchedData} serverToday="2024-02-19" />
 */
export function CalendarPageClient({ initialData, serverToday, locale = 'uk' }: CalendarPageClientProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const dict = getDictionary(locale);

  const isCurrentWeek = weekOffset === 0;

  // Use serverToday as the stable base to avoid hydration mismatch.
  // Both server and client will compute the same startDate from the same base.
  const startDate = useMemo<string>(() => {
    if (weekOffset === 0) return serverToday;
    const base = new Date(serverToday + 'T00:00:00');
    base.setDate(base.getDate() + weekOffset * 7);
    return toLocalDateString(base);
  }, [weekOffset, serverToday]);

  const { data, isLoading, isError, refetch } = useShowCalendar(
    { startDate, days: 7 },
    {
      // Only seed with server-fetched data on the current week to avoid showing
      // stale data when the user navigates away and back.
      initialData: isCurrentWeek && initialData ? initialData : undefined,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  // A week is considered empty when every day has zero episodes.
  const isEmpty =
    !!data && data.days.every((day) => day.episodes.length === 0);

  return (
    <>
      <CalendarWeekNav
        startDate={startDate}
        days={7}
        isCurrentWeek={isCurrentWeek}
        isLoading={isLoading}
        onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
        onNextWeek={() => setWeekOffset((prev) => prev + 1)}
        onThisWeek={() => setWeekOffset(0)}
        today={serverToday}
        locale={locale}
      />

      {isLoading ? (
        <div className="mt-6">
          <CalendarSkeleton />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-sm text-destructive text-center">
            {dict.calendar.loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              if (weekOffset === 0) {
                void refetch();
              } else {
                setWeekOffset(0);
              }
            }}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {dict.calendar.retry}
          </button>
        </div>
      ) : isEmpty ? (
        <CalendarEmptyState locale={locale} />
      ) : data ? (
        <div className="space-y-6 mt-6">
          {data.days.map((day) => (
            <CalendarDayGroup
              key={day.date}
              date={day.date}
              episodes={day.episodes.map(normaliseEpisode)}
              isToday={day.date === serverToday}
              locale={locale}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
