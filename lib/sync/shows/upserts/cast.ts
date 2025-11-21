/**
 * @fileoverview Операції з акторським складом шоу
 * @module lib/sync/shows/upserts/cast
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { showCast } from '@/db/schema';
import type { NewShowCast } from '@/db/schema';
import type { TMDBCastMember } from '@/lib/types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Оновлює/створює акторський склад шоу
 * @param tx - Транзакція бази даних
 * @param showId - Внутрішній ID шоу
 * @param cast - Масив акторів з TMDB
 */
export async function upsertShowCast(
  tx: Tx,
  showId: number,
  cast: TMDBCastMember[]
): Promise<void> {
  if (!cast.length) return;

  const existingCastRows = await tx
    .select({ id: showCast.id, personId: showCast.personId, character: showCast.character })
    .from(showCast)
    .where(eq(showCast.showId, showId));

  const castIdByPersonCharacterMap = new Map<string, number>();
  for (const castRow of existingCastRows)
    castIdByPersonCharacterMap.set(
      `${String(castRow.personId)}|${String(castRow.character ?? '')}`,
      castRow.id as number
    );

  const castUpdates: Array<{ id: number; payload: NewShowCast }> = [];
  const castInserts: NewShowCast[] = [];

  for (const castMember of cast) {
    const payload: NewShowCast = {
      showId,
      personId: Number(castMember.id || 0),
      name: castMember.name || null,
      character: castMember.character || null,
      order: typeof castMember.order === 'number' ? castMember.order : null,
      profilePath: castMember.profile_path || null,
      updatedAt: new Date(),
    };

    const compositeKey = `${payload.personId}|${payload.character ?? ''}`;
    const existingCastId = castIdByPersonCharacterMap.get(compositeKey);

    if (existingCastId) {
      castUpdates.push({ id: existingCastId, payload });
    } else {
      castInserts.push(payload);
    }
  }

  if (castUpdates.length) {
    await Promise.all(
      castUpdates.map((castUpdate) =>
        tx.update(showCast).set(castUpdate.payload).where(eq(showCast.id, castUpdate.id))
      )
    );
  }

  if (castInserts.length) await tx.insert(showCast).values(castInserts);
}
