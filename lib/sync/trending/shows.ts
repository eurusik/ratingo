/**
 * Модуль для обробки trending даних шоу
 */

import {
  processShow,
  type ProcessShowContext,
  type ProcessShowResult,
} from '@/lib/sync/shows/processing';

/**
 * Обробляє масив trending шоу з обмеженою конкуренцією
 */
export async function processTrendingShows(
  traktData: any[],
  config: ProcessShowContext,
  onShowProcessed: (result: ProcessShowResult, durationMs: number) => void
): Promise<void> {
  const { asyncPool } = await import('@/lib/sync/utils');

  await asyncPool(6, traktData, async (traktItem) => {
    const startTime = Date.now();
    const result = await processShow(traktItem, config);
    const duration = Date.now() - startTime;

    onShowProcessed(result, duration);
  });
}

/**
 * Обробляє окреме trending шоу
 */
export async function processTrendingShow(
  traktItem: any,
  config: ProcessShowContext
): Promise<ProcessShowResult> {
  return processShow(traktItem, config);
}
