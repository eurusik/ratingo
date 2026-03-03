'use client';

/**
 * Main orchestrator for the calendar page.
 *
 * Manages week navigation state, mode (all / personalized), fetches calendar
 * data via useShowCalendar or usePersonalizedShowCalendar, and delegates
 * rendering to CalendarWeekNav, CalendarDayGroup, CalendarSkeleton,
 * CalendarEmptyState, and CalendarModeToggle.
 */

import { useEffect, useMemo, useState } from 'react';

import { useShowCalendar, usePersonalizedShowCalendar } from '@/core/query';
import { useAuth } from '@/core/auth';
import { useAuthModalStore } from '@/core/auth';
import type { components } from '@ratingo/api-contract';
import { getDictionary, type Locale } from '@/shared/i18n';

import { CalendarWeekNav } from './calendar-week-nav';
import { CalendarDayGroup, type CalendarEpisode } from './calendar-day-group';
import { CalendarSkeleton } from './calendar-skeleton';
import { CalendarEmptyState } from './calendar-empty-state';
import { CalendarModeToggle, type CalendarMode } from './calendar-mode-toggle';
import { LogIn } from 'lucide-react';

type CalendarResponseDto = components['schemas']['CalendarResponseDto'];

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Shown when the user is in personalized mode but not authenticated.
 * Provides a sign-in prompt using the global auth modal.
 */
function CalendarLoginPrompt({ locale = 'uk' }: { locale?: Locale }) {
  const dict = getDictionary(locale);
  const openLogin = useAuthModalStore((s) => s.openLogin);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-cinema-elevated/30 border border-cinema-border/50 flex items-center justify-center mb-6">
        <LogIn className="w-10 h-10 text-cinema-text-disabled" />
      </div>

      <p className="text-base text-cinema-text-muted max-w-sm leading-relaxed mb-4">
        {dict.calendar.loginRequired}
      </p>

      <button
        type="button"
        onClick={openLogin}
        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        {dict.auth.login}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personalized calendar data wrapper
// ---------------------------------------------------------------------------

interface PersonalizedCalendarContentProps {
  startDate: string;
  serverToday: string;
  locale: Locale;
  onLoadingChange: (isLoading: boolean) => void;
}

/**
 * Renders the personalized calendar data section.
 * Extracted so the hook is only called when the user is authenticated.
 */
function PersonalizedCalendarContent({
  startDate,
  serverToday,
  locale,
  onLoadingChange,
}: PersonalizedCalendarContentProps) {
  const dict = getDictionary(locale);

  const { data, isLoading, isError, refetch } = usePersonalizedShowCalendar(
    { startDate, days: 7 },
    { staleTime: 5 * 60 * 1000 },
  );

  useEffect(() => {
    onLoadingChange(isLoading);
  }, [isLoading, onLoadingChange]);

  useEffect(() => {
    return () => { onLoadingChange(false); };
  }, [onLoadingChange]);

  const isEmpty = !!data && data.days.every((day) => day.episodes.length === 0);

  if (isLoading) {
    return (
      <div className="mt-6">
        <CalendarSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-destructive text-center">{dict.calendar.loadError}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {dict.calendar.retry}
        </button>
      </div>
    );
  }

  if (isEmpty) {
    // Distinguish: user has no watching shows vs no episodes scheduled this week.
    const hasNoWatchingShows = data.watchingShowsCount === 0;
    return (
      <CalendarEmptyState
        locale={locale}
        variant={hasNoWatchingShows ? 'noWatchingShows' : 'personalized'}
      />
    );
  }

  if (data) {
    return (
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
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const CALENDAR_MODE_KEY = 'ratingo:calendar-mode';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
 * Mode:
 * - 'all'          — global calendar (current behaviour); uses initialData for SSR hydration.
 * - 'personalized' — filters to shows the user is watching; no SSR initialData
 *                    (server renders with mode='all' only, toggle is client state).
 *
 * Switching modes resets weekOffset to 0 to prevent stale week data from
 * appearing in the new mode.
 *
 * Mode is persisted to localStorage so the preference survives page reloads.
 * The server always renders with mode='all' to avoid hydration mismatch; the
 * stored value is read client-side in a useEffect after hydration.
 *
 * @example
 * <CalendarPageClient initialData={serverFetchedData} serverToday="2024-02-19" />
 */
export function CalendarPageClient({ initialData, serverToday, locale = 'uk' }: CalendarPageClientProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  // Always start with 'all' on the server to avoid hydration mismatch.
  // The stored preference is applied client-side after mount.
  const [mode, setMode] = useState<CalendarMode>('all');
  const [isPersonalizedLoading, setIsPersonalizedLoading] = useState(false);

  // Restore persisted mode after hydration — runs only on the client.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CALENDAR_MODE_KEY);
      if (stored === 'personalized') {
        setMode('personalized');
      }
    } catch {
      // localStorage unavailable (private browsing, storage quota exceeded, etc.)
    }
  }, []);

  const dict = getDictionary(locale);

  // useAuth is safe here: AuthProvider wraps the whole app.
  const { isAuthenticated } = useAuth();

  const isCurrentWeek = weekOffset === 0;

  // Use serverToday as the stable base to avoid hydration mismatch.
  // Both server and client will compute the same startDate from the same base.
  const startDate = useMemo<string>(() => {
    if (weekOffset === 0) return serverToday;
    const base = new Date(serverToday + 'T00:00:00');
    base.setDate(base.getDate() + weekOffset * 7);
    return toLocalDateString(base);
  }, [weekOffset, serverToday]);

  // Global calendar query (active in 'all' mode).
  const { data, isLoading, isError, refetch } = useShowCalendar(
    { startDate, days: 7 },
    {
      // Only seed with server-fetched data on the current week to avoid showing
      // stale data when the user navigates away and back.
      // Do NOT pass initialData in personalized mode — it's global data only.
      initialData: mode === 'all' && isCurrentWeek && initialData ? initialData : undefined,
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Skip the global query when in personalized mode to avoid wasted requests.
      enabled: mode === 'all',
    },
  );

  // A week is considered empty when every day has zero episodes.
  const isEmpty =
    mode === 'all' && !!data && data.days.every((day) => day.episodes.length === 0);

  /**
   * Handles mode switching. Resets weekOffset to 0 so the user always
   * starts the new mode on the current week — avoids showing week N data
   * from the previous mode while the new query loads.
   *
   * Persists the chosen mode to localStorage so it survives page reloads.
   */
  function handleModeChange(next: CalendarMode) {
    setMode(next);
    setWeekOffset(0);
    try {
      localStorage.setItem(CALENDAR_MODE_KEY, next);
    } catch {
      // Silently ignore — preference won't persist but feature still works
    }
  }

  return (
    <>
      {/* Mode toggle sits above week navigation */}
      <div className="mb-5">
        <CalendarModeToggle mode={mode} onModeChange={handleModeChange} locale={locale} />
      </div>

      <CalendarWeekNav
        startDate={startDate}
        days={7}
        isCurrentWeek={isCurrentWeek}
        isLoading={(isLoading && mode === 'all') || isPersonalizedLoading}
        onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
        onNextWeek={() => setWeekOffset((prev) => prev + 1)}
        onThisWeek={() => setWeekOffset(0)}
        today={serverToday}
        locale={locale}
      />

      {/* Personalized mode */}
      {mode === 'personalized' && (
        isAuthenticated
          ? (
            <PersonalizedCalendarContent
              startDate={startDate}
              serverToday={serverToday}
              locale={locale}
              onLoadingChange={setIsPersonalizedLoading}
            />
          )
          : <CalendarLoginPrompt locale={locale} />
      )}

      {/* Global (all) mode */}
      {mode === 'all' && (
        isLoading ? (
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
        ) : null
      )}
    </>
  );
}
