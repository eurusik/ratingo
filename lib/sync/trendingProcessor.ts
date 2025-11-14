/**
 * Процесор трендів: бере `pending` задачі та обробляє їх паралельно,
 * делегуючи логіку у `processShow()`. Тримає виклик коротким (≤10 с).
 *
 * @example
 * import { runTrendingProcessor } from '@/lib/sync/trendingProcessor';
 * const { processed, succeeded, failed } = await runTrendingProcessor(10);
 * console.log({ processed, succeeded, failed });
 */
import { db } from '@/db';
import { syncJobs, syncTasks } from '@/db/schema';
import { buildMonthlyMaps } from '@/lib/sync/monthly';
import { asyncPool, LRUCache } from '@/lib/sync/utils';
import { processShow } from '@/lib/sync/processShow';
import { eq } from 'drizzle-orm';

/**
 * Обробляє до `limit` задач; оновлює статуси `processing/done/error`.
 * Повертає підсумки по батчу.
 *
 * @example
 * await runTrendingProcessor(12);
 */
export async function runTrendingProcessor(
  limit: number = 10
): Promise<{ success: boolean; processed: number; succeeded: number; failed: number }> {
  const rows = await db
    .select({
      id: syncTasks.id,
      jobId: syncTasks.jobId,
      tmdbId: syncTasks.tmdbId,
      payload: syncTasks.payload,
    })
    .from(syncTasks)
    .where(eq(syncTasks.status, 'pending'))
    .limit(Math.max(1, Math.min(50, limit)));

  if (rows.length === 0) return { success: true, processed: 0, succeeded: 0, failed: 0 };

  const monthly = await buildMonthlyMaps();
  const tmdbDetailsCache = new LRUCache<number, any>(300);
  const tmdbTranslationCache = new LRUCache<number, any>(300);
  const tmdbProvidersCache = new LRUCache<string, any[]>(400);
  const tmdbContentRatingCache = new LRUCache<string, any>(400);
  const tmdbExternalIdsCache = new LRUCache<number, any>(400);
  const currentTrendingTmdbIds = new Set<number>();
  const onRetryLabel = (_label: string) => (_attempt: number, _err: any) => {};

  let succeeded = 0;
  let failed = 0;

  await asyncPool(6, rows, async (task) => {
    try {
      await db
        .update(syncTasks)
        .set({ status: 'processing', attempts: (task as any).attempts + 1, updatedAt: new Date() })
        .where(eq(syncTasks.id, task.id));
    } catch {}
    try {
      const traktItem = (() => {
        const p = (task as any).payload || {};
        const watchers = typeof p?.watchers === 'number' ? p.watchers : undefined;
        const show = p?.traktShow || { ids: { tmdb: task.tmdbId }, title: null };
        return { watchers, show };
      })();
      const maxWatchers = Math.max(
        10000,
        typeof (traktItem as any)?.watchers === 'number' ? (traktItem as any).watchers : 10000
      );
      const out = await processShow(traktItem, {
        monthly,
        maxWatchers,
        animeKeywords: ['anime', 'аніме'],
        tmdbDetailsCache,
        tmdbTranslationCache,
        tmdbProvidersCache,
        tmdbContentRatingCache,
        tmdbExternalIdsCache,
        currentTrendingTmdbIds,
        onRetryLabel,
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

  return { success: true, processed: rows.length, succeeded, failed };
}
