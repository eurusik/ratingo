/**
 * @fileoverview Операції з жанрами шоу - реєстрація жанрів та зв'язки з шоу
 * @module lib/sync/shows/upserts/genres
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { genres as genresTable, showGenres } from '@/db/schema';
import type { NewShowGenre } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Гарантує наявність жанрів у реєстрі та додає зв'язки шоу↔жанр
 * @param tx - Транзакція бази даних
 * @param showId - Внутрішній ID шоу
 * @param tmdbGenres - Жанри TMDB (id, name)
 */
export async function upsertShowGenres(
  tx: Tx,
  showId: number,
  tmdbGenres: Array<{ id?: number; name?: string }>
): Promise<void> {
  const tmdbGenreIds = tmdbGenres.map((g) => Number(g.id)).filter((id) => Number.isFinite(id));
  if (!tmdbGenreIds.length) return;

  // Отримуємо існуючі жанри з реєстру
  const existingGenres = await tx
    .select({ id: genresTable.id, tmdbId: genresTable.tmdbId })
    .from(genresTable)
    .where(inArray(genresTable.tmdbId, tmdbGenreIds));

  const existingMap = new Map<number, number>();
  for (const genreRow of existingGenres as any[])
    existingMap.set((genreRow as any).tmdbId, (genreRow as any).id);

  // Додаємо відсутні жанри до реєстру
  const missingGenres = tmdbGenres.filter((genre) => !existingMap.has(Number(genre.id)));
  if (missingGenres.length) {
    try {
      await tx.insert(genresTable).values(
        missingGenres.map((missingGenre) => ({
          tmdbId: Number(missingGenre.id),
          nameEn: String(missingGenre.name || '') || 'Unknown',
        })) as any[]
      );
    } catch {}
  }

  // Отримуємо всі жанри (включно з новододаними)
  const allGenres = await tx
    .select({ id: genresTable.id, tmdbId: genresTable.tmdbId })
    .from(genresTable)
    .where(inArray(genresTable.tmdbId, tmdbGenreIds));

  const idByTmdb = new Map<number, number>();
  for (const genreRow of allGenres as any[])
    idByTmdb.set((genreRow as any).tmdbId, (genreRow as any).id);

  // Перевіряємо існуючі зв'язки
  const existingLinks = await tx
    .select({ genreId: showGenres.genreId })
    .from(showGenres)
    .where(eq(showGenres.showId, showId));

  const existingSet = new Set<number>(
    (existingLinks as any[]).map((linkRow: any) => Number(linkRow.genreId))
  );

  // Створюємо нові зв'язки
  const linkValues: NewShowGenre[] = [] as any;
  for (const tmdbGid of tmdbGenreIds) {
    const gid = idByTmdb.get(tmdbGid);
    if (!gid || existingSet.has(gid)) continue;
    linkValues.push({ showId, genreId: gid } as any);
  }

  if (linkValues.length) await tx.insert(showGenres).values(linkValues as any[]);
}
