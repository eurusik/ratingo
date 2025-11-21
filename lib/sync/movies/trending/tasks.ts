/**
 * @fileoverview Управління задачами для trending movies processor
 */

import { db } from '@/db';
import { syncJobs, syncTasks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { SyncTask } from './types';

/**
 * Отримати pending задачі для trending movies
 *
 * @param limit - Максимальна кількість задач (обмежено 1-50)
 * @returns Проміс з масивом задач
 *
 * @example
 * ```typescript
 * const tasks = await getPendingTasks(10);
 * console.log('Found', tasks.length, 'pending tasks');
 * ```
 */
export async function getPendingTasks(limit: number): Promise<SyncTask[]> {
  const clampedLimit = Math.max(1, Math.min(50, limit));

  const rows = await db
    .select({
      id: syncTasks.id,
      jobId: syncTasks.jobId,
      tmdbId: syncTasks.tmdbId,
      payload: syncTasks.payload,
      attempts: syncTasks.attempts,
    })
    .from(syncTasks)
    .innerJoin(syncJobs, eq(syncTasks.jobId, syncJobs.id))
    .where(and(eq(syncJobs.type, 'trending_movies'), eq(syncTasks.status, 'pending')))
    .limit(clampedLimit);

  return rows as SyncTask[];
}

/**
 * Оновити статус задачі на "processing"
 *
 * @param taskId - ID задачі
 * @param attempts - Поточна кількість спроб
 * @returns Проміс з результатом оновлення
 *
 * @example
 * ```typescript
 * await updateTaskToProcessing(task.id, task.attempts);
 * ```
 */
export async function updateTaskToProcessing(taskId: number, attempts: number = 0): Promise<void> {
  try {
    await db
      .update(syncTasks)
      .set({
        status: 'processing',
        attempts: attempts + 1,
        updatedAt: new Date(),
      })
      .where(eq(syncTasks.id, taskId));
  } catch {
    // Ігноруємо помилки оновлення статусу
  }
}

/**
 * Оновити статус задачі на "done"
 *
 * @param taskId - ID задачі
 * @returns Проміс з результатом оновлення
 *
 * @example
 * ```typescript
 * await updateTaskToDone(task.id);
 * ```
 */
export async function updateTaskToDone(taskId: number): Promise<void> {
  try {
    await db
      .update(syncTasks)
      .set({ status: 'done', updatedAt: new Date() })
      .where(eq(syncTasks.id, taskId));
  } catch {
    // Ігноруємо помилки оновлення статусу
  }
}

/**
 * Оновити статус задачі на "error" з повідомленням
 *
 * @param taskId - ID задачі
 * @param error - Повідомлення про помилку
 * @returns Проміс з результатом оновлення
 *
 * @example
 * ```typescript
 * await updateTaskToError(task.id, 'Failed to process movie');
 * ```
 */
export async function updateTaskToError(taskId: number, error: string): Promise<void> {
  try {
    await db
      .update(syncTasks)
      .set({
        status: 'error',
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(syncTasks.id, taskId));
  } catch {
    // Ігноруємо помилки оновлення статусу
  }
}

/**
 * Створює партію задач для обробки
 *
 * @param tasksData - Дані для створення задач
 * @returns Проміс з результатом створення
 *
 * @example
 * ```typescript
 * const tasks = await createTasksBatch(taskData);
 * console.log('Створено', tasks.length, 'задач');
 * ```
 */
export async function createTasksBatch(tasksData: any[]): Promise<any[]> {
  // Заглушка для створення партії задач
  // В реальному implementation це буде bulk insert в БД
  return tasksData.map((data) => ({
    id: Math.floor(Math.random() * 1000000),
    ...data,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}
