import type { CalendarEpisode, CalendarMovie, CalendarRange } from '@/shared/api';

export function calendarEpisode(overrides: Partial<CalendarEpisode> = {}): CalendarEpisode {
  return {
    episodeId: `episode-${Math.random().toString(36).slice(2)}`,
    showId: 'show-a',
    showRecordId: 'record-a',
    showSlug: 'show-a',
    showTitle: 'Show A',
    seasonNumber: 1,
    episodeNumber: 2,
    title: 'Title',
    airDate: '2026-11-12T19:00:00.000Z',
    airDateDayOnly: false,
    runtime: 45,
    stillPath: null,
    seasonEpisodeCount: 8,
    showPopularity: 10,
    isTracked: false,
    isSaved: false,
    isWatched: false,
    ...overrides,
  };
}

export function calendarRange(
  episodes: CalendarEpisode[],
  watchingShowsCount?: number,
): CalendarRange {
  return {
    startDate: '2026-11-08T00:00:00.000Z',
    endDate: '2026-11-16T00:00:00.000Z',
    days: [{ date: '2026-11-08', episodes, movies: [] }],
    watchingShowsCount,
  };
}

export function calendarMovie(overrides: Partial<CalendarMovie> = {}): CalendarMovie {
  return {
    mediaItemId: `movie-${Math.random().toString(36).slice(2)}`,
    tmdbId: 1,
    slug: 'movie-a',
    title: 'Movie A',
    poster: null,
    backdrop: null,
    releaseDate: '2026-11-12T00:00:00.000Z',
    releaseDateKind: 'theatrical',
    releaseCountry: 'US',
    popularity: 10,
    isSavedForLater: false,
    isReminderSet: false,
    ...overrides,
  };
}
