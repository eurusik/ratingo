/**
 * Модуль операцій бази даних для процесора трендів
 * Керує всіма взаємодіями з базою даних для управління завданнями
 *
 * @module trendingDatabase
 * @example
 * import { fetchPendingTasks, updateTaskStatus } from '@/lib/sync/trendingProcessor/database';
 * const tasks = await fetchPendingTasks(10);
 * await updateTaskStatus(taskId, 'processing');
 */

import { db } from '@/db';
import { syncTasks } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { TaskData, FetchTasksConfig, UpdateResult, TaskStatus } from './types';

/**
 * Отримує очікуючі завдання з бази даних
 *
 * @param config - Конфігурація отримання
 * @returns Масив даних завдань
 * @example
 * const tasks = await fetchPendingTasks({ limit: 10 });
 * const processingTasks = await fetchPendingTasks({ limit: 5, status: 'processing' });
 */
export async function fetchPendingTasks(config: FetchTasksConfig): Promise<TaskData[]> {
  const { limit, status = 'pending' } = config;

  // Забезпечуємо обмеження в розумних межах
  const safeLimit = Math.max(1, Math.min(50, limit));

  try {
    const rows = await db
      .select({
        id: syncTasks.id,
        jobId: syncTasks.jobId,
        tmdbId: syncTasks.tmdbId,
        payload: syncTasks.payload,
        attempts: syncTasks.attempts,
      })
      .from(syncTasks)
      .where(eq(syncTasks.status, status))
      .limit(safeLimit);

    return rows as TaskData[];
  } catch (error) {
    console.error('Помилка отримання завдань:', error);
    return [];
  }
}

/**
 * Оновлює статус завдання в базі даних
 *
 * @param taskId - ID завдання для оновлення
 * @param status - Новий статус
 * @param errorMessage - Опціональне повідомлення про помилку для невдалих завдань
 * @returns Результат оновлення
 * @example
 * await updateTaskStatus(taskId, 'processing');
 * await updateTaskStatus(taskId, 'error', 'Тайм-аут API');
 */
export async function updateTaskStatus(
  taskId: number,
  status: TaskStatus,
  errorMessage?: string
): Promise<UpdateResult> {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'processing') {
      updateData.attempts = sql`${syncTasks.attempts} + 1`;
    }

    if (status === 'error' && errorMessage) {
      updateData.lastError = errorMessage;
    }

    await db.update(syncTasks).set(updateData).where(eq(syncTasks.id, taskId));

    return {
      success: true,
      affectedRows: 1, // Припускаємо 1 рядок змінено для одиничного оновлення
    };
  } catch (error) {
    console.error(`Помилка оновлення завдання ${taskId} на ${status}:`, error);
    return {
      success: false,
      affectedRows: 0,
    };
  }
}

/**
 * Масово оновлює статуси декількох завдань
 *
 * @param taskIds - Масив ID завдань для оновлення
 * @param status - Новий статус для всіх завдань
 * @returns Результат оновлення
 * @example
 * await bulkUpdateTaskStatus([1, 2, 3], 'processing');
 */
export async function bulkUpdateTaskStatus(
  taskIds: number[],
  status: TaskStatus
): Promise<UpdateResult> {
  if (taskIds.length === 0) {
    return { success: true, affectedRows: 0 };
  }

  try {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'processing') {
      updateData.attempts = sql`${syncTasks.attempts} + 1`;
    }

    // Примітка: Це спрощене масове оновлення. У реальній реалізації
    // ви могли б використати більш ефективний підхід масового оновлення
    let totalAffected = 0;

    for (const taskId of taskIds) {
      const result = await updateTaskStatus(taskId, status);
      if (result.success) {
        totalAffected += result.affectedRows;
      }
    }

    return {
      success: true,
      affectedRows: totalAffected,
    };
  } catch (error) {
    console.error('Помилка масового оновлення:', error);
    return {
      success: false,
      affectedRows: 0,
    };
  }
}

/**
 * Отримує статистику завдань за статусом
 *
 * @returns Кількість завдань за статусом
 * @example
 * const stats = await getTaskStats();
 * console.log(`Очікують: ${stats.pending}, Обробляються: ${stats.processing}`);
 */
export async function getTaskStats(): Promise<Record<TaskStatus, number>> {
  try {
    const results = await db
      .select({
        status: syncTasks.status,
        count: sql<number>`count(*)`,
      })
      .from(syncTasks)
      .groupBy(syncTasks.status);

    const stats: Record<TaskStatus, number> = {
      pending: 0,
      processing: 0,
      done: 0,
      error: 0,
    };

    for (const row of results) {
      if (row.status in stats) {
        stats[row.status as TaskStatus] = row.count;
      }
    }

    return stats;
  } catch (error) {
    console.error('Помилка отримання статистики завдань:', error);
    return { pending: 0, processing: 0, done: 0, error: 0 };
  }
}
