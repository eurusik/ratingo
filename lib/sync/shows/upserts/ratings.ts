/**
 * @fileoverview Операції з рейтингами шоу - рейтинги та дистрибуція голосів
 * @module lib/sync/shows/upserts/ratings
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { showRatings, showRatingBuckets } from '@/db/schema';
import type { NewShowRatings, NewShowRatingBucket } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Створює або оновлює рейтинг шоу в базі даних
 * @param tx - Транзакція бази даних
 * @param showId - Внутрішній ID шоу
 * @param avg - Середній рейтинг
 * @param votes - Кількість голосів
 */
export async function upsertShowRatings(
  tx: Tx,
  showId: number,
  avg: number | null,
  votes: number | null
): Promise<void> {
  const existing = await tx
    .select({ id: showRatings.id })
    .from(showRatings)
    .where(eq(showRatings.showId, showId))
    .limit(1);

  const base: NewShowRatings = {
    showId,
    source: 'trakt',
    avg: avg ?? null,
    votes: votes ?? null,
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    await tx.update(showRatings).set(base).where(eq(showRatings.id, existing[0].id));
  } else {
    await tx.insert(showRatings).values(base);
  }
}

/**
 * Оновлює/створює дистрибуцію голосів 1..10 (Trakt buckets)
 * @param tx - Транзакція бази даних
 * @param showId - Внутрішній ID шоу
 * @param distribution - Мапа bucket→count
 * @returns Кількість змінених/доданих рядків
 */
export async function upsertShowRatingBuckets(
  tx: Tx,
  showId: number,
  distribution?: Record<string, number>
): Promise<number> {
  if (!distribution) return 0;

  const existingBucketRows = await tx
    .select({ id: showRatingBuckets.id, bucket: showRatingBuckets.bucket })
    .from(showRatingBuckets)
    .where(eq(showRatingBuckets.showId, showId));

  const bucketIdByValueMap = new Map<number, number>();
  for (const existingBucketRow of existingBucketRows)
    bucketIdByValueMap.set(existingBucketRow.bucket as number, existingBucketRow.id as number);

  const bucketUpdates: { id: number; count: number }[] = [];
  const bucketInserts: NewShowRatingBucket[] = [];

  for (const [bucketStr, countVal] of Object.entries(distribution)) {
    const bucket = parseInt(bucketStr, 10);
    const count = typeof countVal === 'number' && Number.isFinite(countVal) ? countVal : 0;

    if (!Number.isFinite(bucket) || bucket < 1 || bucket > 10) continue;

    const existingBucketId = bucketIdByValueMap.get(bucket);
    if (existingBucketId) {
      bucketUpdates.push({ id: existingBucketId, count });
    } else {
      bucketInserts.push({
        showId,
        source: 'trakt',
        bucket,
        count,
        updatedAt: new Date(),
      });
    }
  }

  if (bucketUpdates.length) {
    await Promise.all(
      bucketUpdates.map((bucketUpdate) =>
        tx
          .update(showRatingBuckets)
          .set({ count: bucketUpdate.count, updatedAt: new Date() })
          .where(eq(showRatingBuckets.id, bucketUpdate.id))
      )
    );
  }

  if (bucketInserts.length) await tx.insert(showRatingBuckets).values(bucketInserts);

  return bucketUpdates.length + bucketInserts.length;
}
