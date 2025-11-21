/**
 * Головний модуль процесора трендів: обробляє очікуючі завдання паралельно
 * Делегує логіку спеціалізованим модулям для кращої композиції та розширюваності
 *
 * @module trendingProcessor
 * @example
 * import { runTrendingProcessor } from '@/lib/sync/trendingProcessor/processor';
 * const { processed, succeeded, failed } = await runTrendingProcessor(10);
 * console.log({ processed, succeeded, failed });
 */

import { buildMonthlyMaps } from '@/lib/sync/monthly';
import { asyncPool } from '@/lib/sync/utils';
import { createTrendingCache } from './caches';
import { processTrendingTask } from './tasks';
import { fetchPendingTasks, updateTaskStatus } from './database';
import { measurePerformance, createPerformanceMetrics } from './performance';
import type {
  TrendingProcessorConfig,
  TrendingProcessorResult,
  TrendingCache,
  TaskData,
} from './types';

/**
 * Типова конфігурація для процесора трендів
 */
export const DEFAULT_CONFIG: Required<TrendingProcessorConfig> = {
  limit: 10,
  concurrency: 6,
  maxWatchers: 10000,
  animeKeywords: ['аніме', 'anime'],
};

/**
 * Обробляє окреме завдання з належною обробкою помилок та оновленням статусів
 *
 * @param task - Дані завдання для обробки
 * @param monthly - Карти переглядів за місяцями
 * @param cache - Контейнер кешу трендів
 * @param config - Конфігурація процесора
 * @returns Чи була обробка успішною
 * @example
 * const success = await processSingleTask(task, monthly, cache, config);
 */
async function processSingleTask(
  task: TaskData,
  monthly: any,
  cache: TrendingCache,
  config: Required<TrendingProcessorConfig>
): Promise<boolean> {
  try {
    // Оновити статус завдання на обробку
    await updateTaskStatus(task.id, 'processing');

    // Обробити завдання
    const result = await processTrendingTask(
      { payload: task.payload, tmdbId: task.tmdbId },
      {
        monthly,
        cache,
        maxWatchers: config.maxWatchers,
        animeKeywords: config.animeKeywords,
      }
    );

    if (result.success) {
      // Оновити статус завдання на виконано
      await updateTaskStatus(task.id, 'done');
      return true;
    } else {
      // Оновити статус завдання на помилку з повідомленням
      await updateTaskStatus(task.id, 'error', result.error);
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Помилка обробки завдання ${task.id}:`, errorMessage);

    // Спробувати оновити статус завдання на помилку, але не падати, якщо це також не вдається
    try {
      await updateTaskStatus(task.id, 'error', errorMessage);
    } catch (updateError) {
      console.error(`Не вдалося оновити статус завдання ${task.id}:`, updateError);
    }

    return false;
  }
}

/**
 * Запускає процесор трендів з вказаною конфігурацією
 *
 * @param config - Конфігурація процесора
 * @returns Результати обробки
 * @example
 * // Обробка з типовою конфігурацією
 * const result1 = await runTrendingProcessor();
 *
 * // Обробка з користувацькою конфігурацією
 * const result2 = await runTrendingProcessor({
 *   limit: 20,
 *   concurrency: 8,
 *   maxWatchers: 15000,
 * });
 */
export async function runTrendingProcessor(
  config: TrendingProcessorConfig = {}
): Promise<TrendingProcessorResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return await measurePerformance(async () => {
    try {
      // Отримати очікуючі завдання
      const tasks = await fetchPendingTasks({ limit: finalConfig.limit });

      if (tasks.length === 0) {
        return {
          success: true,
          processed: 0,
          succeeded: 0,
          failed: 0,
        };
      }

      // Побудувати місячні карти
      const monthly = await buildMonthlyMaps();

      // Створити контейнер кешу
      const cache = createTrendingCache();

      // Обробити завдання паралельно
      const results = await asyncPool(finalConfig.concurrency, tasks, (task) =>
        processSingleTask(task, monthly, cache, finalConfig)
      );

      // Порахувати успіхи та невдачі
      const succeeded = results.filter(Boolean).length;
      const failed = results.length - succeeded;

      return {
        success: true,
        processed: tasks.length,
        succeeded,
        failed,
      };
    } catch (error) {
      console.error('Помилка в процесорі трендів:', error);

      // Повернути результат невдачі
      return {
        success: false,
        processed: 0,
        succeeded: 0,
        failed: 0,
      };
    }
  }).then((perf) => perf.result);
}
