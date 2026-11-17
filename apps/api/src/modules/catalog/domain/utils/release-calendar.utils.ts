import type { CalendarMovie } from '../repositories/movie.repository.interface';
import type { CalendarEpisode } from '../repositories/show.repository.interface';

import { toIsoDay } from './iso-day.utils';

export interface ReleaseCalendarDay {
  date: string;
  episodes: CalendarEpisode[];
  movies: CalendarMovie[];
  moreMoviesCount?: number;
}

export interface ReleaseCalendarInput {
  episodes: readonly CalendarEpisode[];
  movies: readonly CalendarMovie[];
  movieCountByDay: ReadonlyMap<string, number>;
}

function emptyDay(date: string): ReleaseCalendarDay {
  return { date, episodes: [], movies: [] };
}

function withHiddenMoviesCount(
  day: ReleaseCalendarDay,
  movieCountByDay: ReadonlyMap<string, number>,
): ReleaseCalendarDay {
  const hidden = (movieCountByDay.get(day.date) ?? day.movies.length) - day.movies.length;
  return hidden > 0 ? { ...day, moreMoviesCount: hidden } : day;
}

export function buildReleaseCalendar(input: ReleaseCalendarInput): ReleaseCalendarDay[] {
  const days = new Map<string, ReleaseCalendarDay>();
  const dayOf = (date: string): ReleaseCalendarDay => {
    const day = days.get(date) ?? emptyDay(date);
    days.set(date, day);
    return day;
  };

  for (const episode of input.episodes) {
    dayOf(toIsoDay(episode.airDate)).episodes.push(episode);
  }
  for (const movie of input.movies) {
    dayOf(toIsoDay(movie.releaseDate)).movies.push(movie);
  }

  return [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => withHiddenMoviesCount(day, input.movieCountByDay));
}
