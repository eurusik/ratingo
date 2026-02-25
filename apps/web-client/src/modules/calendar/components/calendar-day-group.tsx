'use client';

/**
 * A single day section in the calendar view.
 *
 * Renders the day header (weekday + date) and either a list of episode cards
 * or a "no new episodes" placeholder when the day is empty.
 */

import { useMemo, useState } from 'react';
import { getDictionary, type Locale } from '@/shared/i18n';
import { cn, pluralize } from '@/shared/utils';
import { CalendarEpisodeCard } from './calendar-episode-card';
import { CalendarShowGroup } from './calendar-show-group';

/** Shape of a single episode entry passed from the calendar data layer. */
export interface CalendarEpisode {
  showId: string;
  showSlug: string;
  showTitle: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  /** Episode title. */
  title: string;
  overview: string | null;
  airDate: string;
  runtime: number | null;
  stillPath: string | null;
}

export interface CalendarDayGroupProps {
  /** Day date in YYYY-MM-DD format. */
  date: string;
  episodes: CalendarEpisode[];
  /** Whether this day is today. */
  isToday: boolean;
  locale?: Locale;
}

/**
 * Manual weekday names to avoid hydration mismatch.
 *
 * Node.js and browsers ship different ICU data for Ukrainian —
 * Node returns the accusative ("Середу") while Chrome returns the
 * nominative ("Середа"). Using a static lookup guarantees identical
 * output on both server and client.
 */
const UK_WEEKDAYS = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'] as const;
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const UK_MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
] as const;

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * Formats a YYYY-MM-DD string into a long weekday + date label.
 *
 * @example
 * formatDayHeader('2024-02-19', 'uk') // "Понеділок, 19 лютого"
 */
function formatDayHeader(date: string, locale: Locale): string {
  const d = new Date(date + 'T00:00:00');
  const weekday = locale === 'uk' ? UK_WEEKDAYS[d.getDay()] : EN_WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = locale === 'uk' ? UK_MONTHS_GENITIVE[d.getMonth()] : EN_MONTHS[d.getMonth()];
  return `${weekday}, ${day} ${month}`;
}

interface ShowGroup {
  showId: string;
  showSlug: string;
  showTitle: string;
  posterPath: string | null;
  episodes: CalendarEpisode[];
}

/** Groups a flat episode list by show, preserving first-appearance order. */
function groupEpisodesByShow(episodes: CalendarEpisode[]): ShowGroup[] {
  const map = new Map<string, ShowGroup>();
  for (const ep of episodes) {
    let group = map.get(ep.showId);
    if (!group) {
      group = { showId: ep.showId, showSlug: ep.showSlug, showTitle: ep.showTitle, posterPath: ep.posterPath, episodes: [] };
      map.set(ep.showId, group);
    }
    group.episodes.push(ep);
  }
  for (const group of map.values()) {
    group.episodes.sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
  }
  return Array.from(map.values());
}

/** Number of show groups visible before the "show more" button appears. */
const VISIBLE_COUNT = 4;

/**
 * Day group component — date header + episode list (or empty state).
 *
 * @example
 * <CalendarDayGroup
 *   date="2024-02-19"
 *   episodes={mondayEpisodes}
 *   isToday={false}
 *   locale="uk"
 * />
 */
export function CalendarDayGroup({
  date,
  episodes,
  isToday,
  locale = 'uk',
}: CalendarDayGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const dict = getDictionary(locale);
  const headerLabel = formatDayHeader(date, locale);

  const showGroups = useMemo(() => groupEpisodesByShow(episodes), [episodes]);
  const hasMore = showGroups.length > VISIBLE_COUNT;
  const visibleGroups = hasMore && !isExpanded ? showGroups.slice(0, VISIBLE_COUNT) : showGroups;
  const remainingCount = showGroups.length - VISIBLE_COUNT;

  return (
    <div className="border-b border-cinema-elevated/50 pb-4 mb-2">
      {/* Day header */}
      <div
        className={cn(
          'flex items-center -mx-3 px-3 py-1.5 rounded-lg',
          isToday && 'bg-blue-500/5',
        )}
      >
        <time
          dateTime={date}
          className={cn(
            'text-base font-semibold',
            isToday ? 'text-white' : 'text-cinema-text-secondary',
          )}
        >
          {headerLabel}
        </time>

        {isToday && (
          <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400">
            {dict.calendar.today}
          </span>
        )}
      </div>

      {/* Episode list or empty placeholder */}
      {episodes.length === 0 ? (
        <p className="py-4 text-sm text-cinema-text-disabled italic">
          {dict.calendar.noEpisodes}
        </p>
      ) : (
        <div className="space-y-1 mt-2">
          {visibleGroups.map((group) =>
            group.episodes.length === 1 ? (
              <CalendarEpisodeCard
                key={`${group.showId}-s${group.episodes[0].seasonNumber}e${group.episodes[0].episodeNumber}`}
                showSlug={group.episodes[0].showSlug}
                showTitle={group.showTitle}
                posterPath={group.posterPath}
                seasonNumber={group.episodes[0].seasonNumber}
                episodeNumber={group.episodes[0].episodeNumber}
                title={group.episodes[0].title}
                runtime={group.episodes[0].runtime}
              />
            ) : (
              <CalendarShowGroup
                key={group.showId}
                showSlug={group.showSlug}
                showTitle={group.showTitle}
                posterPath={group.posterPath}
                episodes={group.episodes}
              />
            ),
          )}

          {hasMore && !isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full py-2 text-sm text-cinema-text-secondary hover:text-white transition-colors"
            >
              {`${dict.calendar.showMoreShows.replace('{count}', String(remainingCount))} ${pluralize(remainingCount, { one: dict.calendar.showMoreShowsOne, few: dict.calendar.showMoreShowsFew, many: dict.calendar.showMoreShowsMany }, locale)}`}
            </button>
          )}

          {hasMore && isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="w-full py-2 text-sm text-cinema-text-secondary hover:text-white transition-colors"
            >
              {dict.calendar.collapse}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
