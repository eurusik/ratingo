/**
 * Модуль для роботи з пов'язаними шоу.
 * Містить функції для забезпечення наявності пов'язаних шоу в БД
 * та створення зв'язків між шоу.
 */

import { db } from '@/db';
import { shows, showRelated } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { ProcessShowContext } from './types';

// Імпортуємо необхідні функції
import { createShowApiClients } from './api';
import { mergeProviders, prepareRelatedShowData } from './processing';

/**
 * Гарантує наявність пов'язаних шоу в БД, додаючи мінімальні дані для відсутніх.
 *
 * Алгоритм:
 * 1. Перевіряє наявність шоу в базі даних за допомогою запиту
 * 2. Визначає TMDB ID які відсутні в базі
 * 3. Обмежує до 12 нових шоу для оптимізації продуктивності
 * 4. Для кожного відсутнього шоу викликає processShow для повної обробки
 *
 * @param tx Транзакція бази даних
 * @param relatedTmdbIds Кандидати TMDB ID пов'язаних шоу
 * @param ctx Контекст обробки з кешами та API клієнтами
 * @returns Кількість доданих записів
 *
 * @example
 * ```typescript
 * const relatedIds = [123, 456, 789, 101, 112];
 * const inserted = await ensureRelatedShows(tx, relatedIds, ctx);
 * console.log(`Додано ${inserted} нових пов'язаних шоу`);
 * ```
 */
export async function ensureRelatedShows(
  tx: any,
  relatedTmdbIds: number[],
  ctx: ProcessShowContext
): Promise<number> {
  if (!relatedTmdbIds.length) return 0;

  const relatedRows = await tx
    .select({ tmdbId: shows.tmdbId })
    .from(shows)
    .where(inArray(shows.tmdbId, relatedTmdbIds))
    .limit(50);

  const existingSetTmdb = new Set<number>(relatedRows.map((row: any) => row.tmdbId));
  const missingIds = relatedTmdbIds.filter((id) => !existingSetTmdb.has(id)).slice(0, 12);

  let inserted = 0;
  const apiClients = createShowApiClients({ caches: ctx, onRetryLabel: ctx.onRetryLabel });

  for (const relTmdbId of missingIds) {
    try {
      // Отримуємо дані для пов'язаного шоу
      const [relDetails, relUk, relUa, relUs] = await Promise.all([
        apiClients.getShowDetails(relTmdbId),
        apiClients.getShowTranslation(relTmdbId),
        apiClients.getWatchProviders(relTmdbId, 'UA'),
        apiClients.getWatchProviders(relTmdbId, 'US'),
      ]);

      if (!relDetails) continue;

      const relProviders = mergeProviders(relUa || [], relUs || []);

      // Отримуємо рейтинги з OMDb
      let relImdbRating: number | null = null;
      let relImdbVotes: number | null = null;
      let relMetacritic: number | null = null;

      if (process.env.OMDB_API_KEY) {
        try {
          const relExt = await apiClients.getExternalIds(relTmdbId);
          const relImdbId = relExt?.imdb_id || null;
          if (relImdbId) {
            const agg = await apiClients.getOmdbRatings(relImdbId);
            relImdbRating = agg.imdbRating;
            relImdbVotes = agg.imdbVotes;
            relMetacritic = agg.metacritic;
          }
        } catch (e) {
          console.error(`Failed to ensure related show ${relTmdbId}`, e);
        }
      }

      // Підготовляємо дані для пов'язаного шоу (використовуємо мінімальні дані)
      const relData = prepareRelatedShowData(
        relDetails,
        relUk,
        relProviders,
        relImdbRating,
        relImdbVotes,
        relMetacritic
      );

      await tx.insert(shows).values(relData);
      inserted++;
    } catch {}
  }

  return inserted;
}

/**
 * Створює зв'язки show↔relatedShow із джерелом (Trakt/TMDB) та ранжуванням.
 *
 * Алгоритм:
 * 1. Отримує внутрішні ID шоу за TMDB ID
 * 2. Очищає існуючі зв'язки для цього шоу
 * 3. Створює нові зв'язки з джерелом та індексом ранжування
 *
 * @param tx Транзакція бази даних
 * @param showId Внутрішній ID шоу для якого створюються зв'язки
 * @param relatedTmdbIds Список TMDB ID пов'язаних шоу
 * @param source Джерело кандидатів: 'trakt' або 'tmdb'
 * @returns Кількість доданих посилань
 *
 * @example
 * ```typescript
 * const showId = 123;
 * const relatedIds = [456, 789, 101];
 * const linksAdded = await linkRelated(tx, showId, relatedIds, 'trakt');
 * console.log(`Додано ${linksAdded} зв'язків для шоу ${showId}`);
 * ```
 */
export async function linkRelated(
  tx: any,
  showId: number,
  relatedTmdbIds: number[],
  source: string
): Promise<number> {
  if (!relatedTmdbIds.length) return 0;

  const relatedRows2 = await tx
    .select({ id: shows.id, tmdbId: shows.tmdbId })
    .from(shows)
    .where(inArray(shows.tmdbId, relatedTmdbIds))
    .limit(50);

  const relMap2 = new Map<number, number>();
  for (const row of relatedRows2 as any[]) relMap2.set((row as any).tmdbId, (row as any).id);

  const existingLinks = await tx
    .select({ relatedShowId: showRelated.relatedShowId })
    .from(showRelated)
    .where(eq(showRelated.showId, showId));

  const existingSet = new Set<number>(
    (existingLinks as any[]).map((linkRow: any) => linkRow.relatedShowId)
  );
  const relationInsertValues: any[] = [];
  let added = 0;

  for (let i = 0; i < relatedTmdbIds.length; i++) {
    const relTmdbId = relatedTmdbIds[i];
    const relIdVal = relMap2.get(relTmdbId);
    if (!relIdVal || existingSet.has(relIdVal)) continue;

    relationInsertValues.push({
      showId,
      relatedShowId: relIdVal,
      source,
      rank: i + 1,
      score: null,
      updatedAt: new Date(),
    });
    added++;
  }

  if (relationInsertValues.length) {
    await tx.insert(showRelated).values(relationInsertValues as any[]);
  }

  return added;
}
