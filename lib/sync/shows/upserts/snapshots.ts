/**
 * @fileoverview Операції з снапшотами шоу - збереження історії популярності
 * @module lib/sync/shows/upserts/snapshots
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { showWatchersSnapshots, shows } from '@/db/schema';
import type { NewShowWatchersSnapshot } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Додає снапшот популярності (watchers) якщо значення змінилося
 * @param tx - Транзакція бази даних
 * @param tmdbId - TMDB ID шоу
 * @param showId - Внутрішній ID шоу
 * @param watchers - Поточна кількість переглядачів
 * @returns Статус операції: `inserted` або `unchanged`
 */
export async function upsertShowWatchersSnapshot(
  tx: Tx,
  tmdbId: number,
  showId: number,
  watchers: number
): Promise<'inserted' | 'unchanged'> {
  const lastSnapRow = await tx
    .select({ watchers: showWatchersSnapshots.watchers })
    .from(showWatchersSnapshots)
    .where(eq(showWatchersSnapshots.tmdbId, tmdbId))
    .orderBy(desc(showWatchersSnapshots.createdAt))
    .limit(1);

  const lastWatchersVal = lastSnapRow[0]?.watchers ?? null;

  if (lastWatchersVal === null || lastWatchersVal !== watchers) {
    await tx.insert(showWatchersSnapshots).values({
      showId,
      tmdbId,
      watchers,
    } as NewShowWatchersSnapshot);
    await tx
      .update(shows)
      .set({ ratingTrakt: watchers, trendingUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(shows.id, showId));
    return 'inserted';
  }

  await tx
    .update(shows)
    .set({ ratingTrakt: watchers, trendingUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(shows.id, showId));
  return 'unchanged';
}
