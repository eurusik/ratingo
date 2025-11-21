import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { movies } from '@/db/schema';
import type { NewMovie } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Створює або оновлює фільм в базі даних */
export async function upsertMovie(
  tx: Tx,
  tmdbId: number,
  payload: NewMovie
): Promise<{ movieId: number; isUpdate: boolean }> {
  const existing = await tx
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.tmdbId, tmdbId))
    .limit(1);

  if (existing.length > 0) {
    const movieId = existing[0].id;
    await tx.update(movies).set(payload).where(eq(movies.id, movieId));
    return { movieId, isUpdate: true };
  }

  const [newMovie] = await tx.insert(movies).values(payload).returning({ id: movies.id });
  return { movieId: newMovie.id, isUpdate: false };
}
