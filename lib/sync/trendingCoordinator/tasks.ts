/**
 * Модуль для створення sync tasks
 * @module trendingCoordinator/tasks
 */

import { db } from '@/db';
import { syncTasks } from '@/db/schema';
import type { SyncTaskCreateData } from './types';

/**
 * Створити sync tasks пакетно
 * @param tasksData - Масив даних для створення tasks
 * @returns Кількість успішно створених tasks
 */
export async function createTasksBatch(tasksData: SyncTaskCreateData[]): Promise<number> {
  if (tasksData.length === 0) {
    return 0;
  }

  try {
    await db.insert(syncTasks).values(tasksData as any);
    return tasksData.length;
  } catch {
    // Якщо виникли дублікати, пробуємо створити по одному
    return await createTasksIndividually(tasksData);
  }
}

/**
 * Створити tasks по одному (для обходу дублікатів)
 * @param tasksData - Масив даних для створення tasks
 * @returns Кількість успішно створених tasks
 */
async function createTasksIndividually(tasksData: SyncTaskCreateData[]): Promise<number> {
  let createdCount = 0;

  for (const taskData of tasksData) {
    try {
      await db.insert(syncTasks).values(taskData as any);
      createdCount++;
    } catch {
      // Ігноруємо помилки дублікатів
      continue;
    }
  }

  return createdCount;
}
