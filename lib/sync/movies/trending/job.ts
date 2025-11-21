/**
 * @fileoverview Управління sync jobs для trending movies
 */

import { db } from '@/db';
import { syncJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Створити нову джобу trending movies sync
 *
 * @returns Проміс з ID створеної джоби
 *
 * @example
 * ```typescript
 * const jobId = await createSyncJob();
 * console.log('Created job:', jobId);
 * ```
 */
export async function createSyncJob(): Promise<number> {
  const job = await db
    .insert(syncJobs)
    .values({
      type: 'trending_movies',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: syncJobs.id });

  return (job[0]?.id as number) || 0;
}

/**
 * Оновити статистику джоби
 *
 * @param jobId - ID джоби
 * @param trendingFetched - Кількість отриманих трендових фільмів
 * @param tasksQueued - Кількість створених задач
 *
 * @example
 * ```typescript
 * await updateJobStats(jobId, 100, 95);
 * ```
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
