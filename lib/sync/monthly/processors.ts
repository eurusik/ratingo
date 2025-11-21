/**
 * Модуль для обробки даних переглядів
 */

import type { TraktWatchedShow, TraktWatchedMovie, WatchersMap } from './types';

/**
 * Конвертує масив даних переглядів шоу в мапу {tmdbId: watchers}
 */
export function processWatchedShows(shows: TraktWatchedShow[]): WatchersMap {
  if (!Array.isArray(shows)) return {};

  return shows.reduce((acc: WatchersMap, item) => {
    const tmdbId = item?.show?.ids?.tmdb;
    const watchers = item?.watchers;

    if (typeof tmdbId === 'number' && typeof watchers === 'number') {
      acc[tmdbId] = watchers;
    }

    return acc;
  }, {});
}

/**
 * Конвертує масив даних переглядів фільмів в мапу {tmdbId: watchers}
 */
export function processWatchedMovies(movies: TraktWatchedMovie[]): WatchersMap {
  if (!Array.isArray(movies)) return {};

  return movies.reduce((acc: WatchersMap, item) => {
    const tmdbId = item?.movie?.ids?.tmdb;
    const watchers = item?.watchers;

    if (typeof tmdbId === 'number' && typeof watchers === 'number') {
      acc[tmdbId] = watchers;
    }

    return acc;
  }, {});
}
