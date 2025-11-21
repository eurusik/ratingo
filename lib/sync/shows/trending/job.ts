/**
 * @fileoverview Управління sync jobs для trending shows
 *
 * @module shows/trending/job
 */

import { db } from '@/db';
import { syncJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Створює новий sync job
 * @returns ID створеного job
 */
export async function createSyncJob(): Promise<number> {
  const job = await db
    .insert(syncJobs)
    .values({
      type: 'trending_shows',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: syncJobs.id });

  return (job[0]?.id as number) || 0;
}

/**
 * Оновлює статистику job
 * @param jobId - ID job для оновлення
 * @param trendingFetched - Кількість отриманих трендових шоу
 * @param tasksQueued - Кількість створених задач
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
