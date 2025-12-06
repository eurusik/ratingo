/**
 * Побудова мап переглядів за календарні місяці (m0..m5) на базі Trakt.
 *
 * @example
 * import { buildMonthlyMaps } from '@/lib/sync/monthly';
 * const monthly = await buildMonthlyMaps();
 * console.log(monthly.m0[1399]);
 */
import { traktClient } from '@/lib/api/trakt';
import { MonthlyMaps } from './types';
import { toWatchersMap } from './utils';

/**
 * Повертає набори `{ tmdbId: watchers }` для шести місяців,
 * з fallback на порожні мапи при помилках.
 *
 * @example
 * const maps = await buildMonthlyMaps();
 */
export async function buildMonthlyMaps(now = new Date()): Promise<MonthlyMaps> {
  const monthStartDate = (d: Date, offsetMonths: number) => {
    const dd = new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };
  const starts = [0, -1, -2, -3, -4, -5].map((o) => monthStartDate(now, o));
  const [m0Start, m1Start, m2Start, m3Start, m4Start, m5Start] = starts;
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
      m0: toWatchersMap(m0),
      m1: toWatchersMap(m1),
      m2: toWatchersMap(m2),
      m3: toWatchersMap(m3),
      m4: toWatchersMap(m4),
      m5: toWatchersMap(m5),
    };
  } catch {
    return { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} };
  }
}

export async function buildMonthlyMapsMovies(now = new Date()): Promise<MonthlyMaps> {
  /**
   * Побудова мап переглядів фільмів за календарні місяці (m0..m5) на базі Trakt.
   *
   * @example
   * const monthly = await buildMonthlyMapsMovies();
   * console.log(monthly.m0[603]);
   */
  const monthStartDate = (d: Date, offsetMonths: number) => {
    const dd = new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };
  const starts = [0, -1, -2, -3, -4, -5].map((o) => monthStartDate(now, o));
  const [m0Start, m1Start, m2Start, m3Start, m4Start, m5Start] = starts;
  try {
    const [m0, m1, m2, m3, m4, m5] = await Promise.all([
      traktClient.getWatchedMovies('monthly', m0Start, 200),
      traktClient.getWatchedMovies('monthly', m1Start, 200),
      traktClient.getWatchedMovies('monthly', m2Start, 200),
      traktClient.getWatchedMovies('monthly', m3Start, 200),
      traktClient.getWatchedMovies('monthly', m4Start, 200),
      traktClient.getWatchedMovies('monthly', m5Start, 200),
    ]);
    const toMap = (list: any[]) => {
      if (!Array.isArray(list)) return {} as Record<number, number>;
      return list.reduce(
        (acc: Record<number, number>, it: any) => {
          const tmdb = it?.movie?.ids?.tmdb;
          const w = it?.watchers;
          if (typeof tmdb === 'number' && typeof w === 'number') acc[tmdb] = w;
          return acc;
        },
        {} as Record<number, number>
      );
    };
    return {
      m0: toMap(m0),
      m1: toMap(m1),
      m2: toMap(m2),
      m3: toMap(m3),
      m4: toMap(m4),
      m5: toMap(m5),
    };
  } catch {
    return { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} };
  }
}
