/**
 * Побудова мап переглядів за календарні місяці (m0..m5) на базі Trakt.
 *
 * @example
 * import { buildMonthlyMaps } from '@/lib/sync/monthly';
 * const monthly = await buildMonthlyMaps();
 * console.log(monthly.m0[1399]);
 */

import {
  buildMonthlyMaps as buildMonthlyMapsCore,
  buildMonthlyMapsMovies as buildMonthlyMapsMoviesCore,
} from './monthly/index';

/**
 * Повертає набори `{ tmdbId: watchers }` для шести місяців,
 * з fallback на порожні мапи при помилках.
 *
 * @example
 * const maps = await buildMonthlyMaps();
 */
export async function buildMonthlyMaps(
  now = new Date()
): Promise<import('./monthly/types').MonthlyMaps> {
  return buildMonthlyMapsCore(now);
}

/**
 * Побудова мап переглядів фільмів за календарні місяці (m0..m5) на базі Trakt.
 *
 * @example
 * const monthly = await buildMonthlyMapsMovies();
 * console.log(monthly.m0[603]);
 */
export async function buildMonthlyMapsMovies(
  now = new Date()
): Promise<import('./monthly/types').MonthlyMaps> {
  return buildMonthlyMapsMoviesCore(now);
}
