/**
 * Модуль для управління показниками продуктивності trending синхронізації
 */

import type { PerformancePhases } from './types';

/**
 * Ініціалізує показники продуктивності
 */
export function createPerformanceTracker() {
  const phases: PerformancePhases = {
    trendingFetchMs: 0,
    monthlyMapsMs: 0,
    perShowAvgMs: 0,
    perShowMaxMs: 0,
    omdbBackfillMs: 0,
    metaBackfillMs: 0,
    calendarSyncMs: 0,
    pruneMs: 0,
  };

  const retryCounts: Record<string, number> = {};
  const perShowTimes: number[] = [];

  const onRetryLabel = (label: string) => (attempt: number, _err: any) => {
    retryCounts[label] = (retryCounts[label] || 0) + 1;
  };

  return {
    phases,
    retryCounts,
    perShowTimes,
    onRetryLabel,
  };
}

/**
 * Записує час виконання операції
 */
export function trackPhase<T>(
  tracker: ReturnType<typeof createPerformanceTracker>,
  phaseName: keyof PerformancePhases,
  fn: () => Promise<T>
): Promise<T> {
  return trackTime(async () => {
    const result = await fn();
    return { result, duration: 0 }; // duration will be set by trackTime
  }).then(({ result, duration }) => {
    tracker.phases[phaseName] = duration;
    return result;
  });
}

/**
 * Додає час обробки шоу
 */
export function addShowTime(
  tracker: ReturnType<typeof createPerformanceTracker>,
  durationMs: number
) {
  tracker.perShowTimes.push(durationMs);
}

/**
 * Обчислює статистику по часу обробки шоу
 */
export function calculateShowStats(tracker: ReturnType<typeof createPerformanceTracker>) {
  if (tracker.perShowTimes.length === 0) {
    return { avg: 0, max: 0 };
  }

  const total = tracker.perShowTimes.reduce((sum, time) => sum + time, 0);
  return {
    avg: Math.round(total / tracker.perShowTimes.length),
    max: Math.max(...tracker.perShowTimes),
  };
}

/**
 * Записує час виконання функції
 */
async function trackTime<T>(
  fn: () => Promise<{ result: T; duration: number }>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const { result } = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}
