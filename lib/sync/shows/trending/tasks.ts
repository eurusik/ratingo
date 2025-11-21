/**
 * @fileoverview Управління задачами для trending shows
 *
 * @module shows/trending/tasks
 */

import { db } from '@/db';
import { syncTasks, syncJobs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { TaskData, SyncTask } from './types';

/**
 * Отримати pending задачі для обробки
 * @param limit - Максимальна кількість задач
 * @returns Масив pending задач
 */
export async function getPendingTasks(limit: number = 10): Promise<SyncTask[]> {
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
    .where(and(eq(syncJobs.type, 'trending_shows'), eq(syncTasks.status, 'pending')))
    .limit(clampedLimit);

  return rows.map((row) => ({
    ...row,
    status: 'pending' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as SyncTask[];
}

/**
 * Оновити статус задачі на processing
 * @param taskId - ID задачі
 * @param attempts - Поточна кількість спроб
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
 * Оновити статус задачі на completed
 * @param taskId - ID задачі
 */
export async function updateTaskToDone(taskId: number): Promise<void> {
  try {
    await db
      .update(syncTasks)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(syncTasks.id, taskId));
  } catch {
    // Ігноруємо помилки оновлення статусу
  }
}

/**
 * Оновити статус задачі на error
 * @param taskId - ID задачі
 * @param error - Повідомлення про помилку
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
 * Створити batch задач
 * @param tasksData - Дані для задач
 * @returns Масив створених задач
 */
export async function createTasksBatch(tasksData: TaskData[]): Promise<any[]> {
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
