import { db } from '@/db';
import { syncJobs, syncTasks } from '@/db/schema';
import { buildMonthlyMapsMovies } from '@/lib/sync/monthly';
import { asyncPool, LRUCache } from '@/lib/sync/utils';
import { processMovie } from '@/lib/sync/processMovie';
import { eq } from 'drizzle-orm';

export async function runTrendingMoviesProcessor(
  limit: number = 10
): Promise<{ success: boolean; processed: number; succeeded: number; failed: number }> {
  const { and } = await import('drizzle-orm');
  const rows = await db
    .select({
      id: syncTasks.id,
      jobId: syncTasks.jobId,
      tmdbId: syncTasks.tmdbId,
      payload: syncTasks.payload,
    })
    .from(syncTasks)
    .innerJoin(syncJobs, eq(syncTasks.jobId, syncJobs.id))
    .where(and(eq(syncJobs.type, 'trending_movies'), eq(syncTasks.status, 'pending')))
    .limit(Math.max(1, Math.min(50, limit)));

  if ((rows as any[]).length === 0) return { success: true, processed: 0, succeeded: 0, failed: 0 };

  const monthly = await buildMonthlyMapsMovies();
  const tmdbDetailsCache = new LRUCache<number, any>(300);
  const tmdbTranslationCache = new LRUCache<number, any>(300);
  const tmdbProvidersCache = new LRUCache<string, any[]>(400);
  const tmdbExternalIdsCache = new LRUCache<number, any>(400);

  let succeeded = 0;
  let failed = 0;

  await asyncPool(6, rows as any[], async (task: any) => {
    try {
      await db
        .update(syncTasks)
        .set({
          status: 'processing',
          attempts: ((task as any).attempts || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(syncTasks.id, task.id));
    } catch {}
    try {
      const traktItem = (() => {
        const p = ((task as any).payload || {}) as any;
        const watchers = typeof p?.watchers === 'number' ? p.watchers : undefined;
        const movie = p?.traktMovie || { ids: { tmdb: task.tmdbId }, title: null };
        return { watchers, movie };
      })();
      const maxWatchers = Math.max(
        10000,
        typeof (traktItem as any)?.watchers === 'number' ? (traktItem as any).watchers : 10000
      );
      const out = await processMovie(traktItem, {
        monthly,
        maxWatchers,
        tmdbDetailsCache,
        tmdbTranslationCache,
        tmdbProvidersCache,
        tmdbExternalIdsCache,
      });
      if (out.error) throw new Error(out.error);
      await db
        .update(syncTasks)
        .set({ status: 'done', updatedAt: new Date() })
        .where(eq(syncTasks.id, task.id));
      succeeded++;
    } catch (e: any) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      try {
        await db
          .update(syncTasks)
          .set({ status: 'error', lastError: msg, updatedAt: new Date() })
          .where(eq(syncTasks.id, task.id));
      } catch {}
    }
  });

  return { success: true, processed: (rows as any[]).length, succeeded, failed };
}
