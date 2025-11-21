/**
 * Основний модуль monthly синхронізації
 */

import { traktClient } from '@/lib/api/trakt';
import { getMonthlyStartDates } from './dates';
import { processWatchedShows, processWatchedMovies } from './processors';
import type { MonthlyMaps } from './types';

/**
 * Повертає мапи переглядів шоу за 6 місяців (m0..m5)
 */
export async function buildMonthlyMaps(now = new Date()): Promise<MonthlyMaps> {
  const [m0Start, m1Start, m2Start, m3Start, m4Start, m5Start] = getMonthlyStartDates(now);

  try {
    const [m0, m1, m2, m3, m4, m5] = await Promise.all([
      traktClient.getWatchedShows('monthly', m0Start, 200),
      traktClient.getWatchedShows('monthly', m1Start, 200),
      traktClient.getWatchedShows('monthly', m2Start, 200),
      traktClient.getWatchedShows('monthly', m3Start, 200),
      traktClient.getWatchedShows('monthly', m4Start, 200),
      traktClient.getWatchedShows('monthly', m5Start, 200),
    ]);

    return {
      m0: processWatchedShows(m0),
      m1: processWatchedShows(m1),
      m2: processWatchedShows(m2),
      m3: processWatchedShows(m3),
      m4: processWatchedShows(m4),
      m5: processWatchedShows(m5),
    };
  } catch {
    return { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} };
  }
}

/**
 * Повертає мапи переглядів фільмів за 6 місяців (m0..m5)
 */
export async function buildMonthlyMapsMovies(now = new Date()): Promise<MonthlyMaps> {
  const [m0Start, m1Start, m2Start, m3Start, m4Start, m5Start] = getMonthlyStartDates(now);

  try {
    const [m0, m1, m2, m3, m4, m5] = await Promise.all([
      traktClient.getWatchedMovies('monthly', m0Start, 200),
      traktClient.getWatchedMovies('monthly', m1Start, 200),
      traktClient.getWatchedMovies('monthly', m2Start, 200),
      traktClient.getWatchedMovies('monthly', m3Start, 200),
      traktClient.getWatchedMovies('monthly', m4Start, 200),
      traktClient.getWatchedMovies('monthly', m5Start, 200),
    ]);

    return {
      m0: processWatchedMovies(m0),
      m1: processWatchedMovies(m1),
      m2: processWatchedMovies(m2),
      m3: processWatchedMovies(m3),
      m4: processWatchedMovies(m4),
      m5: processWatchedMovies(m5),
    };
  } catch {
    return { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} };
  }
}
