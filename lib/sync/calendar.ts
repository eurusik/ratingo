/**
 * Синхронізація календаря ефірів та очищення застарілих записів.
 *
 * @example
 * import { runCalendarSync, pruneStaleAirings } from '@/lib/sync/calendar';
 * const { processed, inserted, updated } = await runCalendarSync();
 * const { deleted } = await pruneStaleAirings();
 */

import { runCalendarSync as runCalendarSyncCore } from './calendar/index';
import { pruneStaleAirings as pruneStaleAiringsCore } from './calendar/prune';

/**
 * Синхронізує ефіри з Trakt календаря для трендових шоу за вікно днів.
 *
 * @example
 * const res = await runCalendarSync();
 */
export async function runCalendarSync(
  trendingSetArg?: Set<number>
): Promise<{ processed: number; inserted: number; updated: number }> {
  return runCalendarSyncCore(trendingSetArg);
}

/**
 * Видаляє ефіри, що не мають валідного шоу/тренда (очищення).
 *
 * @example
 * const res = await pruneStaleAirings();
 */
export async function pruneStaleAirings(): Promise<{ deleted: number }> {
  return pruneStaleAiringsCore();
}
