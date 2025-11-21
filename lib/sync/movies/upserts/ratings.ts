import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { movieRatings, movieRatingBuckets } from '@/db/schema';
import type { NewMovieRatings, NewMovieRatingBucket } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Зберігає агреговані рейтинги Trakt для фільму */
export async function upsertMovieRatings(
  tx: Tx,
  movieId: number,
  avg: number | null,
  votes: number | null
): Promise<void> {
  const existing = await tx
    .select({ id: movieRatings.id })
    .from(movieRatings)
    .where(eq(movieRatings.movieId, movieId))
    .limit(1);

  const base: NewMovieRatings = {
    movieId,
    source: 'trakt',
    avg: avg ?? null,
    votes: votes ?? null,
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    await tx.update(movieRatings).set(base).where(eq(movieRatings.id, existing[0].id));
  } else {
    await tx.insert(movieRatings).values(base);
  }
}

/** Оновлює/створює дистрибуцію голосів 1..10 (Trakt buckets) */
export async function upsertRatingBuckets(
  tx: Tx,
  movieId: number,
  distribution?: Record<string, number>
): Promise<number> {
  if (!distribution) return 0;

  const existingBucketRows = await tx
    .select({ id: movieRatingBuckets.id, bucket: movieRatingBuckets.bucket })
    .from(movieRatingBuckets)
    .where(eq(movieRatingBuckets.movieId, movieId));

  const bucketIdByValueMap = new Map<number, number>();
  for (const existingBucketRow of existingBucketRows)
    bucketIdByValueMap.set(existingBucketRow.bucket as number, existingBucketRow.id as number);

  const bucketUpdates: { id: number; count: number }[] = [];
  const bucketInserts: NewMovieRatingBucket[] = [];

  for (const [bucketStr, countVal] of Object.entries(distribution)) {
    const bucket = parseInt(bucketStr, 10);
    const count = typeof countVal === 'number' && Number.isFinite(countVal) ? countVal : 0;
    if (!Number.isFinite(bucket) || bucket < 1 || bucket > 10) continue;

    const existingBucketId = bucketIdByValueMap.get(bucket);
    if (existingBucketId) bucketUpdates.push({ id: existingBucketId, count });
    else
      bucketInserts.push({
        movieId,
        source: 'trakt',
        bucket,
        count,
        updatedAt: new Date(),
      });
  }

  if (bucketUpdates.length) {
    await Promise.all(
      bucketUpdates.map((bucketUpdate) =>
        tx
          .update(movieRatingBuckets)
          .set({ count: bucketUpdate.count })
          .where(eq(movieRatingBuckets.id, bucketUpdate.id))
      )
    );
  }

  if (bucketInserts.length) {
    await tx.insert(movieRatingBuckets).values(bucketInserts);
  }

  return bucketUpdates.length + bucketInserts.length;
}
