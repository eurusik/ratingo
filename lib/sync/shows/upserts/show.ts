/**
 * @fileoverview Основні операції з шоу - створення та оновлення записів
 * @module lib/sync/shows/upserts/show
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { shows } from '@/db/schema';
import type { NewShow } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Створює або оновлює запис шоу в базі даних
 * @param tx - Транзакція бази даних
 * @param tmdbId - TMDB ID шоу
 * @param payload - Дані шоу для створення/оновлення
 * @returns Об'єкт з showId та прапорцем isUpdate
 */
export async function upsertShow(
  tx: Tx,
  tmdbId: number,
  payload: NewShow
): Promise<{ showId: number; isUpdate: boolean }> {
  // Перевіряємо чи існує шоу з таким TMDB ID
  const existingShow = await tx
    .select({ id: shows.id })
    .from(shows)
    .where(eq(shows.tmdbId, tmdbId))
    .limit(1);

  if (existingShow.length > 0) {
    // Оновлюємо існуюче шоу
    await tx
      .update(shows)
      .set({
        ...payload,
        trendingUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shows.id, existingShow[0].id));

    return { showId: existingShow[0].id, isUpdate: true };
  }

  // Створюємо нове шоу
  const [newShow] = await tx.insert(shows).values(payload).returning({ id: shows.id });

  return { showId: newShow.id, isUpdate: false };
}
