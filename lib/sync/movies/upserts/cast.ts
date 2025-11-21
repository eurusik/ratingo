import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { movieCast } from '@/db/schema';
import type { NewMovieCast } from '@/db/schema';
import type { TMDBCastMember } from '@/lib/types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Зберігає основний каст фільму з унікальністю по personId|character */
export async function upsertMovieCast(
  tx: Tx,
  movieId: number,
  cast: TMDBCastMember[]
): Promise<void> {
  if (!cast.length) return;

  const existingCastRows = await tx
    .select({ id: movieCast.id, personId: movieCast.personId, character: movieCast.character })
    .from(movieCast)
    .where(eq(movieCast.movieId, movieId));

  const castIdByPersonCharacterMap = new Map<string, number>();
  for (const castRow of existingCastRows)
    castIdByPersonCharacterMap.set(
      `${String(castRow.personId)}|${String(castRow.character ?? '')}`,
      castRow.id as number
    );

  const castUpdates: Array<{ id: number; payload: NewMovieCast }> = [];
  const castInserts: NewMovieCast[] = [];

  for (const castMember of cast) {
    const payload: NewMovieCast = {
      movieId,
      personId: Number(castMember.id || 0),
      name: castMember.name || null,
      character: castMember.character || null,
      order: typeof castMember.order === 'number' ? castMember.order : null,
      profilePath: castMember.profile_path || null,
      updatedAt: new Date(),
    };

    const compositeKey = `${payload.personId}|${payload.character ?? ''}`;
    const existingCastId = castIdByPersonCharacterMap.get(compositeKey);
    if (existingCastId) castUpdates.push({ id: existingCastId, payload });
    else castInserts.push(payload);
  }

  if (castUpdates.length)
    await Promise.all(
      castUpdates.map((castUpdate) =>
        tx.update(movieCast).set(castUpdate.payload).where(eq(movieCast.id, castUpdate.id))
      )
    );

  if (castInserts.length) await tx.insert(movieCast).values(castInserts);
}
