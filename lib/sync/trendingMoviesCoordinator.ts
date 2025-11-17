import { db } from '@/db';
import { syncJobs, syncTasks } from '@/db/schema';
import { traktClient } from '@/lib/api/trakt';
import { withRetry } from '@/lib/sync/utils';
import { eq } from 'drizzle-orm';

export async function runTrendingMoviesCoordinator(): Promise<{
  success: boolean;
  jobId: number;
  tasksQueued: number;
  totals: { trendingFetched: number };
}> {
  const job = await db
    .insert(syncJobs)
    .values({
      type: 'trending_movies',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: syncJobs.id });
  const jobId = (job[0]?.id as number) || 0;

  const trending = await withRetry(() => traktClient.getTrendingMovies(100), 3, 300);
  const tasksVals = trending
    .map((it: any) => {
      const tmdbId = it?.movie?.ids?.tmdb;
      if (typeof tmdbId !== 'number' || !Number.isFinite(tmdbId) || tmdbId <= 0) return null;
      const payload = { watchers: it?.watchers ?? null, traktMovie: it?.movie ?? null };
      return {
        jobId,
        tmdbId,
        payload,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    })
    .filter(Boolean) as any[];

  let tasksQueued = 0;
  if (tasksVals.length > 0) {
    try {
      await db.insert(syncTasks).values(tasksVals);
      tasksQueued = tasksVals.length;
    } catch {
      tasksQueued = 0;
      for (const v of tasksVals) {
        try {
          await db.insert(syncTasks).values(v as any);
          tasksQueued++;
        } catch {}
      }
    }
  }

  await db
    .update(syncJobs)
    .set({
      status: 'running',
      updatedAt: new Date(),
      stats: { trendingFetched: trending.length, tasksQueued } as any,
    })
    .where(eq(syncJobs.id, jobId));
  return { success: true, jobId, tasksQueued, totals: { trendingFetched: trending.length } };
}
