import type { CalendarEpisode, CalendarRange } from '@/shared/api';
import { kyivDateKey, weekDays, weekStartOf, type DateKey } from './calendar-dates';

export interface CalendarDay {
  key: DateKey;
  episodes: CalendarEpisode[];
}

export interface StripWeek {
  days: readonly CalendarDay[];
  pickable: ReadonlySet<DateKey>;
}

export interface WeekLayout {
  past: CalendarDay[];
  upcoming: CalendarDay[];
}

export type PastSummary =
  | { kind: 'unwatched'; count: number }
  | { kind: 'allWatched' }
  | { kind: 'episodes'; count: number };

function byAirTimeThenPopularity(left: CalendarEpisode, right: CalendarEpisode): number {
  return (
    Date.parse(left.airDate) - Date.parse(right.airDate) ||
    right.showPopularity - left.showPopularity ||
    left.episodeNumber - right.episodeNumber
  );
}

function rangeEpisodes(range: CalendarRange): CalendarEpisode[] {
  return range.days.flatMap((day) => day.episodes);
}

export function groupEpisodesByDay(range: CalendarRange, weekStart: DateKey): CalendarDay[] {
  const buckets = new Map(weekDays(weekStart).map((key) => [key, [] as CalendarEpisode[]]));
  for (const episode of rangeEpisodes(range)) {
    buckets.get(kyivDateKey(episode.airDate))?.push(episode);
  }
  return [...buckets].map(([key, episodes]) => ({
    key,
    episodes: episodes.sort(byAirTimeThenPopularity),
  }));
}

export function emptyCalendarDays(weekStart: DateKey): CalendarDay[] {
  return weekDays(weekStart).map((key) => ({ key, episodes: [] }));
}

export function summarizePast(days: readonly CalendarDay[]): PastSummary {
  const episodes = days.flatMap((day) => day.episodes);
  const tracked = episodes.filter((episode) => episode.isTracked);
  const unwatched = tracked.filter((episode) => !episode.isWatched).length;
  if (unwatched > 0) return { kind: 'unwatched', count: unwatched };
  if (tracked.length > 0 && tracked.length === episodes.length) return { kind: 'allWatched' };
  return { kind: 'episodes', count: episodes.length };
}

export function splitWeek(
  days: readonly CalendarDay[],
  collapseBefore: DateKey | undefined,
): WeekLayout {
  const withEpisodes = days.filter((day) => day.episodes.length > 0);
  if (collapseBefore === undefined) return { past: [], upcoming: withEpisodes };
  return {
    past: withEpisodes.filter((day) => day.key < collapseBefore),
    upcoming: withEpisodes.filter((day) => day.key >= collapseBefore),
  };
}

export function pickableDays({ past, upcoming }: WeekLayout): Set<DateKey> {
  const openablePast = summarizePast(past).kind === 'allWatched' ? [] : past;
  return new Set([...openablePast, ...upcoming].map((day) => day.key));
}

export function firstEpisodeFrom(
  range: CalendarRange | undefined,
  from: DateKey,
): CalendarEpisode | undefined {
  if (!range) return undefined;
  return rangeEpisodes(range)
    .filter((episode) => kyivDateKey(episode.airDate) >= from)
    .reduce<CalendarEpisode | undefined>(
      (earliest, episode) =>
        earliest && byAirTimeThenPopularity(earliest, episode) <= 0 ? earliest : episode,
      undefined,
    );
}

export function weekLayoutFor(
  days: readonly CalendarDay[],
  weekStart: DateKey,
  today: DateKey,
): WeekLayout {
  return splitWeek(days, weekStart === weekStartOf(today) ? today : undefined);
}

export function buildStripWeek(
  days: readonly CalendarDay[],
  weekStart: DateKey,
  today: DateKey,
): StripWeek {
  return { days, pickable: pickableDays(weekLayoutFor(days, weekStart, today)) };
}
