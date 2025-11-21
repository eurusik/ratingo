/**
 * Модуль продуктивності для процесора трендів
 * Надає функції для моніторингу та оптимізації продуктивності
 *
 * @module trendingPerformance
 * @example
 * import { measurePerformance, getPerformanceMetrics } from '@/lib/sync/trendingProcessor/performance';
 * const result = await measurePerformance(() => processTasks(tasks));
 */

/**
 * Результат вимірювання продуктивності
 */
export interface PerformanceResult<T> {
  /** Результат виконання функції */
  result: T;
  /** Час виконання в мілісекундах */
  duration: number;
  /** Позначка часу початку */
  startTime: Date;
  /** Позначка часу завершення */
  endTime: Date;
}

/**
 * Метрики продуктивності процесора
 */
export interface PerformanceMetrics {
  /** Загальна кількість оброблених завдань */
  totalProcessed: number;
  /** Середній час обробки на завдання */
  averageProcessingTime: number;
  /** Максимальний час обробки */
  maxProcessingTime: number;
  /** Мінімальний час обробки */
  minProcessingTime: number;
  /** Успішно оброблені завдання */
  succeeded: number;
  /** Невдалі завдання */
  failed: number;
  /** Часові мітки по фазах */
  phases: Record<string, number>;
}

/**
 * Вимірює продуктивність виконання асинхронної функції
 *
 * @param fn - Функція для вимірювання
 * @returns Результат вимірювання з часом виконання
 * @example
 * const result = await measurePerformance(async () => {
 *   return await processTasks(tasks);
 * });
 * console.log(`Виконано за ${result.duration}мс`);
 */
export async function measurePerformance<T>(fn: () => Promise<T>): Promise<PerformanceResult<T>> {
  const startTime = new Date();
  const startMs = performance.now();

  try {
    const result = await fn();
    const endMs = performance.now();
    const endTime = new Date();

    return {
      result,
      duration: Math.round(endMs - startMs),
      startTime,
      endTime,
    };
  } catch (error) {
    const endMs = performance.now();
    const endTime = new Date();

    return {
      result: undefined as T,
      duration: Math.round(endMs - startMs),
      startTime,
      endTime,
    };
  }
}

/**
 * Створює метрики продуктивності на основі результатів обробки
 *
 * @param results - Результати обробки завдань
 * @param phases - Часові мітки по фазах
 * @returns Метрики продуктивності
 * @example
 * const metrics = createPerformanceMetrics(processingResults, {
 *   fetch: 150,
 *   processing: 2500,
 *   database: 300
 * });
 */
export function createPerformanceMetrics(
  results: boolean[],
  phases: Record<string, number> = {}
): PerformanceMetrics {
  const succeeded = results.filter(Boolean).length;
  const failed = results.length - succeeded;

  return {
    totalProcessed: results.length,
    averageProcessingTime: 0, // Можна розрахувати якщо є часові мітки
    maxProcessingTime: 0,
    minProcessingTime: 0,
    succeeded,
    failed,
    phases,
  };
}

/**
 * Форматує метрики продуктивності для виведення
 *
 * @param metrics - Метрики продуктивності
 * @returns Відформатований рядок з метриками
 * @example
 * const formatted = formatPerformanceMetrics(metrics);
 * console.log(formatted);
 */
export function formatPerformanceMetrics(metrics: PerformanceMetrics): string {
  const lines = [
    'Метрики продуктивності процесора трендів:',
    `- Всього оброблено: ${metrics.totalProcessed}`,
    `- Успішно: ${metrics.succeeded}`,
    `- Невдало: ${metrics.failed}`,
    `- Успішність: ${metrics.totalProcessed > 0 ? Math.round((metrics.succeeded / metrics.totalProcessed) * 100) : 0}%`,
  ];

  if (Object.keys(metrics.phases).length > 0) {
    lines.push('', 'Фази обробки:');
    for (const [phase, time] of Object.entries(metrics.phases)) {
      lines.push(`- ${phase}: ${time}мс`);
    }
  }

  return lines.join('\n');
}
