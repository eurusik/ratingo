/**
 * Основний модуль trending coordinator
 * @module trendingCoordinator
 *
 * @description
 * Координатор трендів: створює `sync_job` та чергу `sync_tasks` із TMDB/Trakt.
 * Без важкої обробки; повертає швидку відповідь для запуску батч-процесора.
 */

import { createSyncJob, updateJobStats } from './job';
import { getTrendingShows } from './shows';
import { convertShowsToTaskData } from './shows';
import { createTasksBatch } from './tasks';
import type { TrendingCoordinatorResult } from './types';

/**
 * Запустити trending coordinator процес
 *
 * @description
 * Створює джобу типу `trending`, дістає трендові шоу з Trakt,
 * додає задачі по TMDB id. Ідемпотентність на рівні унікального індексу.
 *
 * @returns Проміс з результатом операції
 *
 * @example
 * ```typescript
 * const result = await runTrendingCoordinator();
 * console.log('Job ID:', result.jobId, 'Tasks queued:', result.tasksQueued);
 * ```
 */
export async function runTrendingCoordinator(): Promise<TrendingCoordinatorResult> {
  // Створити sync job
  const jobId = await createSyncJob();

  // Отримати trending shows
  const trendingShows = await getTrendingShows(100);

  // Конвертувати shows в task дані
  const tasksData = convertShowsToTaskData(trendingShows, jobId);

  // Створити sync tasks
  const tasksQueued = await createTasksBatch(tasksData);

  // Оновити статистику job
  await updateJobStats(jobId, trendingShows.length, tasksQueued);

  return {
    success: true,
    jobId,
    tasksQueued,
    totals: {
      trendingFetched: trendingShows.length,
    },
  };
}
