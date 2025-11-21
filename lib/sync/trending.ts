/**
 * Trending синхронізація - тонкий агрегатор
 *
 * Делегує всю логіку до модулів в піддиректорії ./trending/
 * для кращої організації та підтримуваності коду.
 */

import type { TrendingSyncResult } from './trending/types';

/**
 * Запускає повну trending синхронізацію
 *
 * @returns Результат синхронізації зі статистикою та помилками
 */
export async function runTrendingSync(
  options: { limit?: number } = {}
): Promise<TrendingSyncResult> {
  // Делегуємо до trending модуля - функція повинна бути реалізована там
  const trendingModule = await import('./trending/index');

  // Якщо функція не існує, використовуємо runTrendingProcessor як fallback
  if ('runTrendingSync' in trendingModule && typeof trendingModule.runTrendingSync === 'function') {
    return trendingModule.runTrendingSync(options);
  }

  // Fallback: використовуємо процесор трендів напряму
  const { runTrendingProcessor } = trendingModule;
  const result = await runTrendingProcessor({ limit: options.limit ?? 50 });

  // Конвертуємо результат в TrendingSyncResult формат
  return {
    success: result.success,
    updated: result.succeeded,
    added: 0,
    skipped: result.processed - result.succeeded,
    timestamp: new Date().toISOString(),
    totals: { trendingFetched: result.processed },
    related: {
      linksAdded: 0,
      showsInserted: result.succeeded,
      source: { trakt: result.succeeded, tmdb: result.succeeded },
      candidatesTotal: result.processed,
      showsWithCandidates: result.succeeded,
    },
    ratings: { updated: 0, bucketsUpserted: 0 },
    prune: { airingsDeleted: 0 },
    backfill: { omdbUpdated: 0, metaUpdated: 0 },
    snapshots: { inserted: result.succeeded, unchanged: 0, processed: result.processed },
    perf: {
      phases: {
        trendingFetchMs: 0,
        monthlyMapsMs: 0,
        perShowAvgMs: 0,
        perShowMaxMs: 0,
        omdbBackfillMs: 0,
        metaBackfillMs: 0,
        calendarSyncMs: 0,
        pruneMs: 0,
      },
      retries: {},
    },
    errors: result.failed > 0 ? [`${result.failed} tasks failed`] : [],
    errorCount: result.failed,
  } as TrendingSyncResult;
}
