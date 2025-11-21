import { db } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { movieWatchersSnapshots } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Додає снапшот популярності (watchers) якщо значення змінилося */
export async function upsertWatchersSnapshot(
  tx: Tx,
  tmdbId: number,
  movieId: number,
  watchers: number
): Promise<'inserted' | 'unchanged'> {
  const lastSnapRow = await tx
    .select({ watchers: movieWatchersSnapshots.watchers })
    .from(movieWatchersSnapshots)
    .where(eq(movieWatchersSnapshots.tmdbId, tmdbId))
    .orderBy(desc(movieWatchersSnapshots.createdAt))
    .limit(1);

  const lastWatchersVal = lastSnapRow[0]?.watchers ?? null;
  if (lastWatchersVal === null || lastWatchersVal !== watchers) {
    await tx.insert(movieWatchersSnapshots).values({ movieId, tmdbId, watchers });
    return 'inserted';
  }
  return 'unchanged';
}
