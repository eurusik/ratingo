/**
 * Модуль для створення sync job
 * @module trendingCoordinator/job
 */

import { db } from '@/db';
import { syncJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Створити нову sync job типу 'trending'
 * @returns Проміс з ID створеної job
 */
export async function createSyncJob(): Promise<number> {
  const job = await db
    .insert(syncJobs)
    .values({
      type: 'trending',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: syncJobs.id });

  return job[0]?.id || 0;
}

/**
 * Оновити статистику sync job
 * @param jobId - ID job для оновлення
 * @param trendingFetched - Кількість отриманих trending shows
 * @param tasksQueued - Кількість створених tasks
 */
export async function updateJobStats(
  jobId: number,
  trendingFetched: number,
  tasksQueued: number
): Promise<void> {
  await db
    .update(syncJobs)
    .set({
      status: 'running',
      updatedAt: new Date(),
      stats: { trendingFetched, tasksQueued } as any,
    })
    .where(eq(syncJobs.id, jobId));
}
