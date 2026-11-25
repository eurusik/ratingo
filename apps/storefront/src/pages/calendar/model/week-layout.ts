import type { CalendarEpisode, CalendarMediaType, CalendarMovie, CalendarRange } from '@/shared/api';
import { kyivDateKey, weekDays, weekStartOf, type DateKey } from './calendar-dates';
import type { CalendarMode } from './calendar-query';
import { planDay } from './day-plan';

export interface CalendarDay {
  key: DateKey;
  episodes: CalendarEpisode[];
  movies: CalendarMovie[];
  moreMovies: number;
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
  | { kind: 'episodes'; count: number }
  | { kind: 'movies'; count: number };

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

function byPopularity(left: CalendarMovie, right: CalendarMovie): number {
  return right.popularity - left.popularity;
}

function emptyDay(key: DateKey): CalendarDay {
  return { key, episodes: [], movies: [], moreMovies: 0 };
}

export function groupByDay(range: CalendarRange, weekStart: DateKey): CalendarDay[] {
  const buckets = new Map(weekDays(weekStart).map((key) => [key, emptyDay(key)]));
  for (const episode of rangeEpisodes(range)) {
    buckets.get(kyivDateKey(episode.airDate))?.episodes.push(episode);
  }
  for (const rangeDay of range.days) {
    const day = buckets.get(rangeDay.date);
    if (!day) continue;
    day.movies.push(...rangeDay.movies);
    day.moreMovies += rangeDay.moreMoviesCount ?? 0;
  }
  return [...buckets.values()].map((day) => ({
    ...day,
    episodes: day.episodes.sort(byAirTimeThenPopularity),
    movies: day.movies.sort(byPopularity),
  }));
}

export function emptyCalendarDays(weekStart: DateKey): CalendarDay[] {
  return weekDays(weekStart).map(emptyDay);
}

export type CountKind = CalendarMediaType | 'premiere';

export function countKindFor(type: CalendarMediaType, mode: CalendarMode | undefined): CountKind {
  return mode === 'premieres' ? 'premiere' : type;
}

export function movieCount(day: CalendarDay): number {
  return day.movies.length + day.moreMovies;
}

export function premiereCount(day: CalendarDay): number {
  return planDay(day.episodes, 'premieres').visible.length;
}

function hasReleases(day: CalendarDay): boolean {
  return day.episodes.length > 0 || movieCount(day) > 0;
}

export function summarizePast(days: readonly CalendarDay[]): PastSummary {
  const episodes = days.flatMap((day) => day.episodes);
  const movies = days.reduce((sum, day) => sum + movieCount(day), 0);
  if (episodes.length === 0 && movies > 0) return { kind: 'movies', count: movies };
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
  const withReleases = days.filter(hasReleases);
  if (collapseBefore === undefined) return { past: [], upcoming: withReleases };
  return {
    past: withReleases.filter((day) => day.key < collapseBefore),
    upcoming: withReleases.filter((day) => day.key >= collapseBefore),
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
